// Decides the priority of a new maintenance request.
//
// 1. Ask the AI service (Python + FastAPI) for a prediction.
// 2. If it is down, slow (over 3 seconds) or returns something odd,
//    fall back to simple keyword rules so the request is never blocked.

const AI_TIMEOUT_MS = 3000;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];

// Words that point to danger, damage spreading, or a tenant left without
// a basic service. Matched against title + description, lower case.
const HIGH_KEYWORDS = [
  "fire", "smoke", "burning", "gas", "flood", "flooding", "burst", "sewage",
  "spark", "sparks", "shock", "exposed wire", "live wire", "no water",
  "no power", "no electricity", "collapse", "collapsed", "cracked wall",
  "break-in", "broken into", "won't lock", "wont lock", "can't lock",
  "cannot lock", "locked out", "ceiling leak", "leaking from ceiling",
];

const MEDIUM_KEYWORDS = [
  "leak", "leaking", "drip", "blocked", "clogged", "not working", "broken",
  "no hot water", "toilet", "socket", "lock", "window", "pest", "rats", "cockroach",
];

// Default when no keyword matches.
const CATEGORY_DEFAULT = {
  PLUMBING: "MEDIUM",
  ELECTRICAL: "MEDIUM",
  SECURITY: "MEDIUM",
  STRUCTURAL: "MEDIUM",
  PEST: "MEDIUM",
  APPLIANCE: "LOW",
  OTHER: "LOW",
};

export function rulePriority({ title, description, category }) {
  const text = `${title} ${description}`.toLowerCase();
  if (HIGH_KEYWORDS.some((k) => text.includes(k))) return "HIGH";
  if (MEDIUM_KEYWORDS.some((k) => text.includes(k))) return "MEDIUM";
  return CATEGORY_DEFAULT[category] ?? "LOW";
}

async function askAiService(request) {
  const base = process.env.AI_SERVICE_URL;
  if (!base) return null;

  const res = await fetch(`${base.replace(/\/$/, "")}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: request.title,
      description: request.description,
      category: request.category,
      location_in_unit: request.locationInUnit ?? "",
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`AI service answered ${res.status}`);

  const body = await res.json();
  const priority = String(body.priority || "").toUpperCase();
  if (!PRIORITIES.includes(priority)) throw new Error("AI service returned an unknown priority");
  const confidence = Number(body.confidence);
  return { priority, confidence: Number.isFinite(confidence) ? confidence : null };
}

// Returns { priority, prioritySource, aiPriority, aiConfidence }
export async function decidePriority(request) {
  try {
    const ai = await askAiService(request);
    if (ai) {
      return { priority: ai.priority, prioritySource: "AI", aiPriority: ai.priority, aiConfidence: ai.confidence };
    }
  } catch (err) {
    console.warn(`AI service unavailable, using keyword rules instead (${err.message})`);
  }
  return { priority: rulePriority(request), prioritySource: "RULE", aiPriority: null, aiConfidence: null };
}
