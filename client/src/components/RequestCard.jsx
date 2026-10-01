import { Link } from "react-router";
import { PriorityChip, StatusChip } from "./ui.jsx";
import { PRIORITY, categoryLabel, timeAgo } from "../lib/format.js";

// One request in a list. The coloured strip on the left shows the priority
// at a glance, so the landlord can scan the queue quickly.
export default function RequestCard({ request: r, showTenant = false }) {
  const closed = r.status === "RESOLVED" || r.status === "CANCELLED";
  return (
    <Link
      to={`/requests/${r.id}`}
      className={`card relative block overflow-hidden py-3.5 pr-4 pl-5 transition hover:border-brand-600 ${closed ? "opacity-70" : ""}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${PRIORITY[r.priority]?.dot ?? "bg-slate-300"}`} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold leading-snug">{r.title}</p>
        <PriorityChip priority={r.priority} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {categoryLabel(r.category)}
        {r.locationInUnit ? ` · ${r.locationInUnit}` : ""}
        {showTenant && r.unit ? ` · ${r.unit.label}, ${r.tenant?.name}` : ""}
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <StatusChip status={r.status} />
        <span className="text-xs text-muted">{timeAgo(r.reportedAt)}</span>
      </div>
    </Link>
  );
}
