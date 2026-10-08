// Offline queue for new maintenance requests.
//
// When the tenant submits without a connection, the request is saved on the
// phone (IndexedDB) and shown as "Waiting for connection". As soon as the
// phone is back online the queue is sent to the API. Each request carries a
// clientId (UUID), so if a send is repeated the server keeps only one copy.

import { useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import { api } from "./api.js";
import { uploadPhotos } from "./photos.js";

const KEY = "tms.outbox";
const listeners = new Set();
let syncing = false;

const notify = (items) => listeners.forEach((fn) => fn(items));

export async function getQueue() {
  return (await get(KEY)) || [];
}

async function saveQueue(items) {
  await set(KEY, items);
  notify(items);
}

// item = the request body plus the owner's user id and any photos (Blobs).
// If the request itself was already saved but its photos weren't, the item
// carries requestId, and only the photos are sent next time.
export async function enqueue(userId, body, { photos = [], requestId = null } = {}) {
  const items = await getQueue();
  items.push({ ...body, photos, requestId, ownerId: userId, queuedAt: new Date().toISOString(), error: null });
  await saveQueue(items);
}

const update = async (clientId, changes) =>
  saveQueue((await getQueue()).map((i) => (i.clientId === clientId ? { ...i, ...changes } : i)));

export async function discard(clientId) {
  await saveQueue((await getQueue()).filter((i) => i.clientId !== clientId));
}

// Sends everything in the queue. Stops at the first network failure
// (still offline). A request the server rejects is kept with its error,
// so the tenant can see what went wrong and edit or discard it.
export async function syncQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    for (const item of await getQueue()) {
      if (item.error) continue;
      const { ownerId, queuedAt, error, photos = [], requestId, ...body } = item;
      try {
        // 1. The report itself (skipped if it was saved on an earlier try).
        let id = requestId;
        if (!id) {
          id = (await api("/requests", { method: "POST", body })).request.id;
          await update(item.clientId, { requestId: id });
        }
        // 2. Its photos.
        if (photos.length) await uploadPhotos(id, photos);
        await saveQueue((await getQueue()).filter((i) => i.clientId !== item.clientId));
      } catch (err) {
        if (err.network) break;
        await update(item.clientId, { error: err.message });
      }
    }
  } finally {
    syncing = false;
  }
}

export async function retry(clientId) {
  await saveQueue((await getQueue()).map((i) => (i.clientId === clientId ? { ...i, error: null } : i)));
  await syncQueue();
}

// React hook: the current user's queued requests, kept up to date.
export function useQueue(userId) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const update = (all) => setItems(all.filter((i) => i.ownerId === userId));
    getQueue().then(update);
    listeners.add(update);
    return () => listeners.delete(update);
  }, [userId]);
  return items;
}

// Called once when the app starts.
export function startAutoSync() {
  syncQueue();
  window.addEventListener("online", () => syncQueue());
  // Also try every 30 seconds, in case the "online" event was missed
  // (for example the Wi-Fi was on but the server was down).
  setInterval(() => syncQueue(), 30_000);
}
