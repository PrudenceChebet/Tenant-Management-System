import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError, validate } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { decidePriority } from "../services/priority.js";

const router = Router();
router.use(requireAuth);

const CATEGORIES = ["PLUMBING", "ELECTRICAL", "STRUCTURAL", "SECURITY", "APPLIANCE", "PEST", "OTHER"];
const STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"];
const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const OPEN = new Set(["SUBMITTED", "ASSIGNED", "IN_PROGRESS"]);

// Which status can follow which. Anything else is rejected.
const NEXT_STATUS = {
  SUBMITTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  CANCELLED: [],
};

const listInclude = {
  unit: { select: { id: true, label: true, property: { select: { id: true, name: true } } } },
  tenant: { select: { id: true, name: true, phone: true } },
  _count: { select: { photos: true } },
};

// Loads a request and checks the logged-in user is allowed to see it:
// tenants only their own, landlords only those in their properties.
async function findRequestFor(user, id) {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });
  if (!request) throw new HttpError(404, "Request not found");
  const allowed =
    user.role === "TENANT" ? request.tenantId === user.id : request.unit.property.landlordId === user.id;
  if (!allowed) throw new HttpError(404, "Request not found");
  return request;
}

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "Invalid request id");
  return id;
};

// ---------- Create (tenant) ----------

const createSchema = z.object({
  // Made on the phone with crypto.randomUUID(), so a request synced twice
  // from the offline queue is only saved once.
  clientId: z.string().uuid("clientId must be a UUID"),
  title: z.string().trim().min(3, "Title is too short").max(120),
  description: z.string().trim().min(10, "Describe the problem in a bit more detail").max(2000),
  category: z.enum(CATEGORIES),
  locationInUnit: z.string().trim().max(60).optional(),
  // When the tenant pressed submit. Earlier than now if it waited offline.
  reportedAt: z.coerce.date().optional(),
});

// POST /api/requests
router.post("/", requireRole("TENANT"), async (req, res) => {
  const data = validate(createSchema, req.body);

  // Already synced before? Return the saved copy instead of a duplicate.
  const existing = await prisma.maintenanceRequest.findUnique({ where: { clientId: data.clientId } });
  if (existing) {
    if (existing.tenantId !== req.user.id) throw new HttpError(409, "clientId already used");
    return res.status(200).json({ request: existing, duplicate: true });
  }

  const unit = await prisma.unit.findUnique({ where: { tenantId: req.user.id } });
  if (!unit) throw new HttpError(403, "Your account is not linked to a unit yet. Ask your landlord to add you.");

  const now = new Date();
  const reportedAt = data.reportedAt && data.reportedAt <= now ? data.reportedAt : now;
  const priority = await decidePriority(data);

  try {
    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRequest.create({
        data: {
          clientId: data.clientId,
          title: data.title,
          description: data.description,
          category: data.category,
          locationInUnit: data.locationInUnit,
          reportedAt,
          tenantId: req.user.id,
          unitId: unit.id,
          ...priority,
        },
      });
      await tx.statusHistory.create({
        data: { requestId: created.id, toStatus: "SUBMITTED", changedById: req.user.id },
      });
      return created;
    });
    res.status(201).json({ request, duplicate: false });
  } catch (err) {
    // Two copies arrived at the same moment: the unique index caught it.
    if (err.code === "P2002") {
      const saved = await prisma.maintenanceRequest.findUnique({ where: { clientId: data.clientId } });
      return res.status(200).json({ request: saved, duplicate: true });
    }
    throw err;
  }
});

// ---------- List ----------

// GET /api/requests?status=SUBMITTED
// Open requests first, then by priority (HIGH first), then oldest first.
router.get("/", async (req, res) => {
  const status = req.query.status;
  if (status && !STATUSES.includes(status)) throw new HttpError(400, `status must be one of ${STATUSES.join(", ")}`);

  const where =
    req.user.role === "TENANT"
      ? { tenantId: req.user.id }
      : { unit: { property: { landlordId: req.user.id } } };
  if (status) where.status = status;

  const requests = await prisma.maintenanceRequest.findMany({ where, include: listInclude });

  requests.sort(
    (a, b) =>
      Number(!OPEN.has(a.status)) - Number(!OPEN.has(b.status)) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.reportedAt - b.reportedAt,
  );

  res.json({
    requests: requests.map(({ _count, ...r }) => ({ ...r, photoCount: _count.photos })),
  });
});

// ---------- Detail ----------

// GET /api/requests/:id  (includes the status timeline for the tenant)
router.get("/:id", async (req, res) => {
  const id = idParam(req);
  await findRequestFor(req.user, id);

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      ...listInclude,
      photos: { select: { id: true, url: true, createdAt: true } },
      history: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { name: true, role: true } } },
      },
      overrides: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { name: true } } },
      },
    },
  });
  const { _count, ...rest } = request;
  res.json({ request: { ...rest, photoCount: _count.photos } });
});

// ---------- Status update ----------

const statusSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().trim().max(255).optional(),
});

// PATCH /api/requests/:id/status
// Landlord moves the request along. A tenant may only cancel while it is SUBMITTED.
router.patch("/:id/status", async (req, res) => {
  const id = idParam(req);
  const { status, note } = validate(statusSchema, req.body);
  const current = await findRequestFor(req.user, id);

  if (req.user.role === "TENANT" && !(status === "CANCELLED" && current.status === "SUBMITTED")) {
    throw new HttpError(403, "Tenants can only cancel a request before the landlord picks it up");
  }
  if (!NEXT_STATUS[current.status].includes(status)) {
    throw new HttpError(400, `Can't move a request from ${current.status} to ${status}`);
  }

  const request = await prisma.$transaction(async (tx) => {
    const updated = await tx.maintenanceRequest.update({
      where: { id },
      data: { status, resolvedAt: status === "RESOLVED" ? new Date() : undefined },
    });
    await tx.statusHistory.create({
      data: { requestId: id, fromStatus: current.status, toStatus: status, note, changedById: req.user.id },
    });
    return updated;
  });

  res.json({ request });
});

// ---------- Priority override (landlord) ----------

const overrideSchema = z.object({
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reason: z.string().trim().max(255).optional(),
});

// PATCH /api/requests/:id/priority
// Logged in PriorityOverride so the corrections can be used to retrain the model.
router.patch("/:id/priority", requireRole("LANDLORD"), async (req, res) => {
  const id = idParam(req);
  const { priority, reason } = validate(overrideSchema, req.body);
  const current = await findRequestFor(req.user, id);

  if (current.priority === priority) throw new HttpError(400, `Priority is already ${priority}`);
  if (!OPEN.has(current.status)) throw new HttpError(400, "This request is already closed");

  const request = await prisma.$transaction(async (tx) => {
    await tx.priorityOverride.create({
      data: { requestId: id, fromPriority: current.priority, toPriority: priority, reason, changedById: req.user.id },
    });
    return tx.maintenanceRequest.update({
      where: { id },
      data: { priority, prioritySource: "LANDLORD" },
    });
  });

  res.json({ request });
});

export default router;
