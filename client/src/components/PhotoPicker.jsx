import { useEffect, useRef, useState } from "react";
import { compressImage } from "../lib/photos.js";

// Lets the tenant take or choose up to `max` photos and shows thumbnails.
// `photos` is an array of Blobs; `onChange` gets the new array.
export default function PhotoPicker({ photos, onChange, max }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState([]);

  // Thumbnails for the selected photos (freed again when they change).
  useEffect(() => {
    const urls = photos.map((p) => URL.createObjectURL(p));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photos]);

  async function pick(e) {
    const files = [...e.target.files].slice(0, max - photos.length);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    const compressed = await Promise.all(files.map(compressImage));
    onChange([...photos, ...compressed]);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {previews.map((src, i) => (
        <div key={src} className="relative size-24 overflow-hidden rounded-xl border border-line bg-ground">
          <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(photos.filter((_, j) => j !== i))}
            className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-white"
            aria-label={`Remove photo ${i + 1}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ))}
      {photos.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-line bg-white text-muted transition hover:border-brand-600 hover:text-brand-700"
        >
          <span className="flex flex-col items-center gap-1 text-xs font-medium">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {busy ? "Preparing…" : "Add photo"}
          </span>
        </button>
      )}
      <input ref={inputRef} id="photo-input" type="file" accept="image/*" multiple className="hidden" onChange={pick} />
    </div>
  );
}
