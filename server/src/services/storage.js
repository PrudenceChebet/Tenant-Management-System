// Where request photos are stored.
//
// If CLOUDINARY_URL is set in .env, photos go to Cloudinary (a cloud image
// host with a free tier). Otherwise they are saved in server/uploads on this
// computer, so photo upload still works for local testing without an account.

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../uploads");
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// The Cloudinary SDK reads CLOUDINARY_URL from the environment by itself.
export const usingCloudinary = () => Boolean(process.env.CLOUDINARY_URL);

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "tms/requests",
        resource_type: "image",
        // Shrink very large phone photos and let Cloudinary pick the best format.
        transformation: [{ width: 1600, height: 1600, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
      },
      (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })),
    );
    stream.end(buffer);
  });
}

async function saveLocally(buffer, mimetype) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${EXT[mimetype] ?? "jpg"}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return { url: `/uploads/${name}`, publicId: `local:${name}` };
}

// Returns { url, publicId }
export function saveImage(buffer, mimetype) {
  return usingCloudinary() ? uploadToCloudinary(buffer) : saveLocally(buffer, mimetype);
}

export async function deleteImage(publicId) {
  try {
    if (publicId.startsWith("local:")) {
      await unlink(path.join(UPLOAD_DIR, path.basename(publicId.slice(6))));
    } else if (usingCloudinary()) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (err) {
    // The database row is removed either way; a leftover file is harmless.
    console.warn(`Could not delete image ${publicId}: ${err.message}`);
  }
}
