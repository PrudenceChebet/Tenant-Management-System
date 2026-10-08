// Objective 3: tenants attach photos to their maintenance requests.

import { Router } from "express";
import multer from "multer";
import { prisma } from "../db.js";
import { HttpError } from "../lib/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { deleteImage, saveImage } from "../services/storage.js";

const router = Router({ mergeParams: true });

export const MAX_PHOTOS_PER_REQUEST = 5;
const MAX_FILES_PER_UPLOAD = 3;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per photo
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// Files are kept in memory only long enough to pass them on to storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FILES_PER_UPLOAD },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype)
      ? cb(null, true)
      : cb(new HttpError(400, "Only JPG, PNG or WebP photos can be uploaded")),
});

// Turns multer's own errors into friendly messages.
function receivePhotos(req, res, next) {
  upload.array("photos", MAX_FILES_PER_UPLOAD)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof HttpError) return next(err);
    if (err.code === "LIMIT_FILE_SIZE") return next(new HttpError(400, "Each photo must be 5 MB or smaller"));
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return next(new HttpError(400, `Send at most ${MAX_FILES_PER_UPLOAD} photos at a time, in the "photos" field`));
    }
    next(err);
  });
}

// Only the tenant who reported the request can add or remove its photos.
async function ownRequest(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(404, "Request not found");
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: { _count: { select: { photos: true } } },
  });
  if (!request || request.tenantId !== req.user.id) throw new HttpError(404, "Request not found");
  return request;
}

// POST /api/requests/:id/photos   (multipart form, field name "photos")
router.post("/", requireAuth, requireRole("TENANT"), receivePhotos, async (req, res) => {
  const request = await ownRequest(req);
  const files = req.files ?? [];
  if (files.length === 0) throw new HttpError(400, "Choose at least one photo");
  if (request._count.photos + files.length > MAX_PHOTOS_PER_REQUEST) {
    throw new HttpError(400, `A request can have at most ${MAX_PHOTOS_PER_REQUEST} photos`);
  }
  if (["RESOLVED", "CANCELLED"].includes(request.status)) {
    throw new HttpError(400, "This request is closed, so photos can't be added");
  }

  const saved = [];
  for (const file of files) {
    let stored;
    try {
      stored = await saveImage(file.buffer, file.mimetype);
    } catch (err) {
      console.error("Photo upload failed:", err.message ?? err);
      throw new HttpError(500, "The photo couldn't be stored. If you use Cloudinary, check CLOUDINARY_URL in server/.env.");
    }
    const { url, publicId } = stored;
    saved.push(
      await prisma.requestPhoto.create({
        data: { requestId: request.id, url, publicId },
        select: { id: true, url: true, createdAt: true },
      }),
    );
  }
  res.status(201).json({ photos: saved });
});

// DELETE /api/requests/:id/photos/:photoId
router.delete("/:photoId", requireAuth, requireRole("TENANT"), async (req, res) => {
  const request = await ownRequest(req);
  const photo = await prisma.requestPhoto.findUnique({ where: { id: Number(req.params.photoId) || 0 } });
  if (!photo || photo.requestId !== request.id) throw new HttpError(404, "Photo not found");
  await prisma.requestPhoto.delete({ where: { id: photo.id } });
  await deleteImage(photo.publicId);
  res.status(204).end();
});

export default router;
