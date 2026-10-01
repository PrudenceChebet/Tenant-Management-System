import { useState } from "react";
import { useRequests } from "../lib/useRequests.js";
import { OPEN_STATUSES, PRIORITY } from "../lib/format.js";
import RequestCard from "../components/RequestCard.jsx";
import { Alert, EmptyState, Spinner } from "../components/ui.jsx";

const FILTERS = [
  { key: "open", label: "Open", match: (r) => OPEN_STATUSES.includes(r.status) },
  { key: "new", label: "New", match: (r) => r.status === "SUBMITTED" },
  { key: "closed", label: "Closed", match: (r) => !OPEN_STATUSES.includes(r.status) },
  { key: "all", label: "All", match: () => true },
];

// Objective 3: the landlord's queue, already sorted by the API
// (open first, then HIGH, MEDIUM, LOW, then oldest first).
export default function LandlordHomePage() {
  const { requests, error } = useRequests();
  const [filter, setFilter] = useState("open");

  if (!requests) return error ? <Alert>{error}</Alert> : <Spinner />;

  const open = requests.filter((r) => OPEN_STATUSES.includes(r.status));
  const counts = Object.fromEntries(Object.keys(PRIORITY).map((p) => [p, open.filter((r) => r.priority === p).length]));
  const shown = requests.filter(FILTERS.find((f) => f.key === filter).match);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Maintenance requests</h1>
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-3 gap-2">
        {Object.entries(PRIORITY).map(([key, p]) => (
          <div key={key} className="card px-3 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <span className={`size-2.5 rounded-full ${p.dot}`} />
              {p.label}
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{counts[key]}</p>
            <p className="text-xs text-muted">open</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap ${filter === f.key ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-line"}`}
          >
            {f.label} <span className="tabular-nums opacity-70">{requests.filter(f.match).length}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nothing here">No requests match this filter.</EmptyState>
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => (
            <RequestCard key={r.id} request={r} showTenant />
          ))}
        </div>
      )}
    </div>
  );
}
