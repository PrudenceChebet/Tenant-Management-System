// End-to-end API tests. They call the real running server.
//
// Before running:  npm run db:seed   (fresh demo data)
//                  npm run dev       (in another terminal)
// Then:            npm run test:api
//
// The tests add data, so run `npm run db:seed` again afterwards for a clean demo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = process.env.API_URL || "http://localhost:4000";

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const login = async (email) => (await api("POST", "/api/auth/login", { body: { email, password: "Password123" } })).data.token;

const newRequest = (overrides = {}) => ({
  clientId: randomUUID(),
  title: "Pipe burst in kitchen",
  description: "Water is flooding the kitchen floor from under the sink",
  category: "PLUMBING",
  locationInUnit: "kitchen",
  ...overrides,
});

let landlord, brian, faith;

test("health check", async () => {
  const { status, data } = await api("GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(data.database, "connected");
});

test("login: wrong password is rejected, right password returns a token", async () => {
  const bad = await api("POST", "/api/auth/login", { body: { email: "brian@tms.test", password: "nope" } });
  assert.equal(bad.status, 401);

  const good = await api("POST", "/api/auth/login", { body: { email: "brian@tms.test", password: "Password123" } });
  assert.equal(good.status, 200);
  assert.ok(good.data.token);
  assert.equal(good.data.user.role, "TENANT");
  assert.equal(good.data.user.passwordHash, undefined, "password hash must never be sent");

  landlord = await login("landlord@tms.test");
  brian = await login("brian@tms.test");
  faith = await login("faith@tms.test");
});

test("protected routes need a token", async () => {
  assert.equal((await api("GET", "/api/requests")).status, 401);
  assert.equal((await api("GET", "/api/requests", { token: "garbage" })).status, 401);
});

test("me: tenant sees their unit", async () => {
  const { data } = await api("GET", "/api/auth/me", { token: brian });
  assert.equal(data.unit.label, "A1");
  assert.equal(data.unit.property.name, "Kimathi Court");
});

test("register: validates input and blocks duplicate emails", async () => {
  const bad = await api("POST", "/api/auth/register", { body: { name: "X", email: "not-an-email", password: "123", role: "TENANT" } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.details.length >= 3);

  const dup = await api("POST", "/api/auth/register", {
    body: { name: "Brian Again", email: "brian@tms.test", password: "Password123", role: "TENANT" },
  });
  assert.equal(dup.status, 409);
});

test("tenant creates a request and gets a priority (from the AI, or the keyword rule if the AI is off)", async () => {
  const { status, data } = await api("POST", "/api/requests", { token: brian, body: newRequest() });
  assert.equal(status, 201);
  assert.equal(data.request.status, "SUBMITTED");
  assert.equal(data.request.priority, "HIGH");
  assert.ok(["AI", "RULE"].includes(data.request.prioritySource));
});

test("offline sync: sending the same clientId twice saves it once", async () => {
  const body = newRequest({ title: "Bedroom window will not close", description: "The bedroom window latch is broken and it won't close", category: "STRUCTURAL" });
  const first = await api("POST", "/api/requests", { token: brian, body });
  const second = await api("POST", "/api/requests", { token: brian, body });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.request.id, first.data.request.id);
});

test("offline sync: reportedAt keeps the time the tenant pressed submit", async () => {
  const reportedAt = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const { data } = await api("POST", "/api/requests", { token: brian, body: newRequest({ reportedAt }) });
  assert.equal(new Date(data.request.reportedAt).toISOString(), reportedAt);
  assert.ok(new Date(data.request.createdAt) > new Date(reportedAt));
});

test("landlord cannot create requests; bad input is rejected", async () => {
  assert.equal((await api("POST", "/api/requests", { token: landlord, body: newRequest() })).status, 403);
  const bad = await api("POST", "/api/requests", { token: brian, body: { clientId: "x", title: "", category: "FOOD" } });
  assert.equal(bad.status, 400);
});

test("tenants only see their own requests", async () => {
  const mine = await api("GET", "/api/requests", { token: faith });
  assert.ok(mine.data.requests.length > 0);
  assert.ok(mine.data.requests.every((r) => r.tenant.name === "Faith Chebet"));

  const briansList = await api("GET", "/api/requests", { token: brian });
  const someoneElses = briansList.data.requests[0].id;
  assert.equal((await api("GET", `/api/requests/${someoneElses}`, { token: faith })).status, 404);
});

test("landlord list: open requests first, HIGH before MEDIUM before LOW", async () => {
  const { data } = await api("GET", "/api/requests", { token: landlord });
  const open = new Set(["SUBMITTED", "ASSIGNED", "IN_PROGRESS"]);
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  for (let i = 1; i < data.requests.length; i++) {
    const a = data.requests[i - 1];
    const b = data.requests[i];
    const key = (r) => [open.has(r.status) ? 0 : 1, rank[r.priority]];
    const [ka, kb] = [key(a), key(b)];
    assert.ok(ka[0] < kb[0] || (ka[0] === kb[0] && ka[1] <= kb[1]), `wrong order at position ${i}`);
  }
});

test("status: landlord moves it along, invalid jumps are blocked, timeline is kept", async () => {
  const { data } = await api("POST", "/api/requests", { token: faith, body: newRequest({ title: "Kitchen tap dripping", description: "The kitchen tap keeps dripping all night long" }) });
  const id = data.request.id;

  assert.equal((await api("PATCH", `/api/requests/${id}/status`, { token: landlord, body: { status: "RESOLVED" } })).status, 400);
  assert.equal((await api("PATCH", `/api/requests/${id}/status`, { token: faith, body: { status: "ASSIGNED" } })).status, 403);

  for (const status of ["ASSIGNED", "IN_PROGRESS", "RESOLVED"]) {
    const r = await api("PATCH", `/api/requests/${id}/status`, { token: landlord, body: { status, note: `Moved to ${status}` } });
    assert.equal(r.status, 200);
  }

  const detail = await api("GET", `/api/requests/${id}`, { token: faith });
  assert.deepEqual(detail.data.request.history.map((h) => h.toStatus), ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]);
  assert.ok(detail.data.request.resolvedAt);
});

test("tenant can cancel only while SUBMITTED", async () => {
  const { data } = await api("POST", "/api/requests", { token: faith, body: newRequest({ title: "Duplicate report", description: "Sent this by mistake, please ignore" }) });
  const r = await api("PATCH", `/api/requests/${data.request.id}/status`, { token: faith, body: { status: "CANCELLED" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.request.status, "CANCELLED");
});

test("landlord overrides the priority and the change is logged", async () => {
  const { data } = await api("POST", "/api/requests", { token: brian, body: newRequest({ title: "Paint peeling", description: "Paint is peeling off the bedroom wall", category: "OTHER" }) });
  const id = data.request.id;
  assert.equal(data.request.priority, "LOW");

  assert.equal((await api("PATCH", `/api/requests/${id}/priority`, { token: brian, body: { priority: "HIGH" } })).status, 403);

  const r = await api("PATCH", `/api/requests/${id}/priority`, { token: landlord, body: { priority: "MEDIUM", reason: "Damp may be behind it" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.request.priority, "MEDIUM");
  assert.equal(r.data.request.prioritySource, "LANDLORD");

  const detail = await api("GET", `/api/requests/${id}`, { token: landlord });
  assert.equal(detail.data.request.overrides.length, 1);
  assert.equal(detail.data.request.overrides[0].fromPriority, "LOW");
});

test("new tenant: blocked until the landlord links them to a unit", async () => {
  const email = `new-${Date.now()}@tms.test`;
  const reg = await api("POST", "/api/auth/register", { body: { name: "New Tenant", email, password: "Password123", role: "TENANT" } });
  assert.equal(reg.status, 201);
  const token = reg.data.token;

  assert.equal((await api("POST", "/api/requests", { token, body: newRequest() })).status, 403);

  const props = await api("GET", "/api/properties", { token: landlord });
  const vacant = props.data.properties[0].units.find((u) => !u.tenant);
  assert.ok(vacant, "seed data should have a vacant unit");

  const link = await api("PUT", `/api/units/${vacant.id}/tenant`, { token: landlord, body: { tenantEmail: email } });
  assert.equal(link.status, 200);

  assert.equal((await api("POST", "/api/requests", { token, body: newRequest() })).status, 201);

  // Put the unit back to vacant so the test can run again.
  await api("PUT", `/api/units/${vacant.id}/tenant`, { token: landlord, body: { tenantEmail: null } });
});

test("unknown endpoints return 404", async () => {
  assert.equal((await api("GET", "/api/nothing-here")).status, 404);
});

// ---------- photos (objective 3) ----------

// A real 1x1 pixel PNG, so the upload is a valid image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadPhotos(token, requestId, files) {
  const form = new FormData();
  for (const f of files) form.append("photos", new Blob([f.data], { type: f.type }), f.name);
  const res = await fetch(`${BASE}/api/requests/${requestId}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

test("photos: tenant attaches photos and they show on the request", async () => {
  const { data } = await api("POST", "/api/requests", { token: brian, body: newRequest({ title: "Leak with photo" }) });
  const id = data.request.id;

  const up = await uploadPhotos(brian, id, [
    { data: PNG, type: "image/png", name: "leak1.png" },
    { data: PNG, type: "image/png", name: "leak2.png" },
  ]);
  assert.equal(up.status, 201);
  assert.equal(up.data.photos.length, 2);

  // The photo file can be downloaded.
  const url = up.data.photos[0].url;
  const img = await fetch(url.startsWith("http") ? url : BASE + url);
  assert.equal(img.status, 200);

  const detail = await api("GET", `/api/requests/${id}`, { token: landlord });
  assert.equal(detail.data.request.photos.length, 2);
  assert.equal(detail.data.request.photoCount, 2);

  // Tenant removes one.
  const del = await fetch(`${BASE}/api/requests/${id}/photos/${up.data.photos[0].id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${brian}` },
  });
  assert.equal(del.status, 204);
  assert.equal((await api("GET", `/api/requests/${id}`, { token: brian })).data.request.photos.length, 1);
});

test("photos: wrong file types, too many photos and other people's requests are rejected", async () => {
  const { data } = await api("POST", "/api/requests", { token: brian, body: newRequest({ title: "Photo limits" }) });
  const id = data.request.id;

  const text = await uploadPhotos(brian, id, [{ data: Buffer.from("hello"), type: "text/plain", name: "note.txt" }]);
  assert.equal(text.status, 400);

  const four = await uploadPhotos(brian, id, Array.from({ length: 4 }, (_, i) => ({ data: PNG, type: "image/png", name: `p${i}.png` })));
  assert.equal(four.status, 400);

  assert.equal((await uploadPhotos(faith, id, [{ data: PNG, type: "image/png", name: "x.png" }])).status, 404);
  assert.equal((await uploadPhotos(landlord, id, [{ data: PNG, type: "image/png", name: "x.png" }])).status, 403);

  // 5 photos is the maximum per request.
  await uploadPhotos(brian, id, Array.from({ length: 3 }, (_, i) => ({ data: PNG, type: "image/png", name: `a${i}.png` })));
  await uploadPhotos(brian, id, Array.from({ length: 2 }, (_, i) => ({ data: PNG, type: "image/png", name: `b${i}.png` })));
  const sixth = await uploadPhotos(brian, id, [{ data: PNG, type: "image/png", name: "c.png" }]);
  assert.equal(sixth.status, 400);
});
