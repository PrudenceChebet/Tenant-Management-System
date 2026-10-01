// Small wrapper around fetch for talking to the TMS API.
// It adds the login token, turns error responses into ApiError,
// and marks network failures (offline, server down) so callers can queue.

const TOKEN_KEY = "tms.token";

export class ApiError extends Error {
  constructor(message, { status = 0, details, network = false } = {}) {
    super(message);
    this.status = status;
    this.details = details;
    this.network = network; // true = never reached the server
  }
}

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the user just has to log in again next time */
  }
};

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("You're offline or the server can't be reached.", { network: true });
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // A 5xx from the dev proxy usually means the API itself isn't running.
    if (res.status >= 502 && res.status <= 504) {
      throw new ApiError("The server can't be reached.", { status: res.status, network: true });
    }
    if (res.status === 401 && token) {
      window.dispatchEvent(new Event("tms:logged-out"));
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, { status: res.status, details: data?.details });
  }
  return data;
}

// Turns { details: [{ field, message }] } into { field: message } for forms.
export const fieldErrors = (err) =>
  Object.fromEntries((err?.details || []).map((d) => [d.field, d.message]));

// crypto.randomUUID only works on https or localhost. When the app is opened
// from a phone over plain http on Wi-Fi, use this fallback instead.
export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
