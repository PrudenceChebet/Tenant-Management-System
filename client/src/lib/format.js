// Labels, colours and date formatting shared by the screens.

export const CATEGORIES = [
  { value: "PLUMBING", label: "Plumbing", hint: "Leaks, taps, toilets, drains" },
  { value: "ELECTRICAL", label: "Electrical", hint: "Sockets, lights, wiring, power" },
  { value: "STRUCTURAL", label: "Structural", hint: "Walls, roof, doors, windows" },
  { value: "SECURITY", label: "Security", hint: "Locks, gates, grills" },
  { value: "APPLIANCE", label: "Appliance", hint: "Cooker, water heater, fridge" },
  { value: "PEST", label: "Pests", hint: "Rats, cockroaches, bedbugs" },
  { value: "OTHER", label: "Other", hint: "Anything else" },
];
export const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const STATUS = {
  QUEUED: { label: "Waiting for connection", className: "bg-slate-100 text-slate-700 border border-dashed border-slate-400" },
  SUBMITTED: { label: "Submitted", className: "bg-sky-50 text-sky-800" },
  ASSIGNED: { label: "Assigned", className: "bg-violet-50 text-violet-800" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-800" },
  RESOLVED: { label: "Resolved", className: "bg-emerald-50 text-emerald-800" },
  CANCELLED: { label: "Cancelled", className: "bg-slate-100 text-slate-500" },
};

export const PRIORITY = {
  HIGH: { label: "High", className: "bg-red-600 text-white", dot: "bg-red-600" },
  MEDIUM: { label: "Medium", className: "bg-amber-400 text-amber-950", dot: "bg-amber-400" },
  LOW: { label: "Low", className: "bg-slate-200 text-slate-700", dot: "bg-slate-400" },
};

export const OPEN_STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"];

// What the landlord can move a request to next (same rules as the API).
export const NEXT_STATUS = {
  SUBMITTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  CANCELLED: [],
};
export const NEXT_STATUS_ACTION = {
  ASSIGNED: "Assign",
  IN_PROGRESS: "Start work",
  RESOLVED: "Mark resolved",
  CANCELLED: "Cancel request",
};

export function prioritySourceText(r) {
  if (r.prioritySource === "AI") {
    const pct = r.aiConfidence != null ? ` (${Math.round(r.aiConfidence * 100)}% confident)` : "";
    return `Recommended by AI${pct}`;
  }
  if (r.prioritySource === "RULE") return "Set by keyword rules (AI unavailable)";
  return "Changed by landlord";
}

const dateFmt = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : "");

export function timeAgo(d) {
  const mins = Math.round((Date.now() - new Date(d)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
