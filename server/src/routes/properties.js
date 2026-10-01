import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError, validate } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

// Landlord tools: properties, units, and linking a tenant to a unit.
const router = Router();
const landlordOnly = [requireAuth, requireRole("LANDLORD")];

const unitInclude = { tenant: { select: { id: true, name: true, email: true, phone: true } } };

async function ownProperty(landlordId, id) {
  if (!Number.isInteger(id)) throw new HttpError(404, "Property not found");
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || property.landlordId !== landlordId) throw new HttpError(404, "Property not found");
  return property;
}

// GET /api/properties
router.get("/properties", landlordOnly, async (req, res) => {
  const properties = await prisma.property.findMany({
    where: { landlordId: req.user.id },
    orderBy: { name: "asc" },
    include: { units: { orderBy: { label: "asc" }, include: unitInclude } },
  });
  res.json({ properties });
});

const propertySchema = z.object({
  name: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(150),
});

// POST /api/properties
router.post("/properties", landlordOnly, async (req, res) => {
  const data = validate(propertySchema, req.body);
  const property = await prisma.property.create({ data: { ...data, landlordId: req.user.id } });
  res.status(201).json({ property });
});

const unitSchema = z.object({ label: z.string().trim().min(1).max(20) });

// POST /api/properties/:id/units
router.post("/properties/:id/units", landlordOnly, async (req, res) => {
  const property = await ownProperty(req.user.id, Number(req.params.id));
  const { label } = validate(unitSchema, req.body);
  const clash = await prisma.unit.findUnique({ where: { propertyId_label: { propertyId: property.id, label } } });
  if (clash) throw new HttpError(409, `Unit ${label} already exists in ${property.name}`);
  const unit = await prisma.unit.create({ data: { label, propertyId: property.id } });
  res.status(201).json({ unit });
});

const assignSchema = z.object({
  // Email of a registered tenant, or null to mark the unit vacant.
  tenantEmail: z.string().trim().toLowerCase().email().nullable(),
});

// PUT /api/units/:id/tenant
router.put("/units/:id/tenant", landlordOnly, async (req, res) => {
  const unitId = Number(req.params.id);
  if (!Number.isInteger(unitId)) throw new HttpError(404, "Unit not found");
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw new HttpError(404, "Unit not found");
  await ownProperty(req.user.id, unit.propertyId);
  const { tenantEmail } = validate(assignSchema, req.body);

  let tenantId = null;
  if (tenantEmail) {
    const tenant = await prisma.user.findUnique({ where: { email: tenantEmail }, include: { unit: true } });
    if (!tenant || tenant.role !== "TENANT") throw new HttpError(404, "No tenant account with that email");
    if (tenant.unit && tenant.unit.id !== unit.id) {
      throw new HttpError(409, `${tenant.name} is already linked to another unit`);
    }
    tenantId = tenant.id;
  }

  const updated = await prisma.unit.update({ where: { id: unit.id }, data: { tenantId }, include: unitInclude });
  res.json({ unit: updated });
});

export default router;
