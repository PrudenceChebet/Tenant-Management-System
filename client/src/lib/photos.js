import { api } from "./api.js";

export const MAX_PHOTOS = 3; // per report (the server allows 5 per request in total)
const MAX_SIDE = 1600;

// Phone cameras take 3 to 8 MB photos. Shrinking them to 1600 px JPEG before
// upload makes them about 10 times smaller: faster on slow networks and
// cheaper on mobile data, and still clear enough to see the problem.
export async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // unusual format: send it as it is and let the server decide
  }
}

export async function uploadPhotos(requestId, blobs) {
  const form = new FormData();
  blobs.forEach((b, i) => form.append("photos", b, `photo-${i + 1}.jpg`));
  return (await api(`/requests/${requestId}/photos`, { method: "POST", body: form })).photos;
}

export const deletePhoto = (requestId, photoId) =>
  api(`/requests/${requestId}/photos/${photoId}`, { method: "DELETE" });
