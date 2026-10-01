import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import {
  NEXT_STATUS,
  NEXT_STATUS_ACTION,
  OPEN_STATUSES,
  PRIORITY,
  STATUS,
  categoryLabel,
  formatDate,
  prioritySourceText,
} from "../lib/format.js";
import { Alert, PriorityChip, Spinner, StatusChip } from "../components/ui.jsx";

// One request: details, priority, status timeline (objective 4),
// and the landlord's controls (objective 3).
export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const flash = useLocation().state?.flash;
  const [request, setRequest] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRequest((await api(`/requests/${id}`)).request);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (!request) return error ? <Alert>{error}</Alert> : <Spinner />;

  const isLandlord = user.role === "LANDLORD";
  const r = request;

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-block text-sm font-medium text-brand-700">
        ← Back
      </Link>
      {flash && <Alert kind={flash.kind}>{flash.text}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-snug">{r.title}</h1>
          <StatusChip status={r.status} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Type</dt>
          <dd>{categoryLabel(r.category)}</dd>
          {r.locationInUnit && (
            <>
              <dt className="text-muted">Where</dt>
              <dd>{r.locationInUnit}</dd>
            </>
          )}
          <dt className="text-muted">Unit</dt>
          <dd>
            {r.unit.property.name}, {r.unit.label}
          </dd>
          {isLandlord && (
            <>
              <dt className="text-muted">Tenant</dt>
              <dd>
                {r.tenant.name}
                {r.tenant.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${r.tenant.phone}`} className="font-medium text-brand-700">
                      {r.tenant.phone}
                    </a>
                  </>
                )}
              </dd>
            </>
          )}
          <dt className="text-muted">Reported</dt>
          <dd>{formatDate(r.reportedAt)}</dd>
        </dl>
        <p className="rounded-xl bg-ground p-3 text-[15px] leading-relaxed whitespace-pre-wrap">{r.description}</p>
      </div>

      <PriorityCard request={r} canOverride={isLandlord && OPEN_STATUSES.includes(r.status)} onChanged={load} />

      {isLandlord ? (
        <LandlordActions request={r} onChanged={load} />
      ) : (
        r.status === "SUBMITTED" && <TenantCancel request={r} onChanged={load} />
      )}

      <Timeline request={r} />
    </div>
  );
}

function PriorityCard({ request: r, canOverride, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [priority, setPriority] = useState(r.priority);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/requests/${r.id}/priority`, { method: "PATCH", body: { priority, reason: reason || undefined } });
      setEditing(false);
      setReason("");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Priority</p>
          <div className="mt-1 flex items-center gap-2">
            <PriorityChip priority={r.priority} />
            <span className="text-sm text-muted">{prioritySourceText(r)}</span>
          </div>
          {r.prioritySource === "LANDLORD" && r.aiPriority && (
            <p className="mt-1 text-xs text-muted">The AI had suggested {PRIORITY[r.aiPriority].label.toLowerCase()}.</p>
          )}
        </div>
        {canOverride && !editing && (
          <button className="btn btn-secondary py-2 text-sm" onClick={() => setEditing(true)}>
            Change
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mt-4 space-y-3 border-t border-line pt-4">
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PRIORITY).map(([value, p]) => (
              <label
                key={value}
                className={`btn cursor-pointer border py-2 text-sm ${priority === value ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`}
              >
                <input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} className="sr-only" />
                <span className={`size-2.5 rounded-full ${p.dot}`} />
                {p.label}
              </label>
            ))}
          </div>
          <input
            id="override-reason"
            className="input"
            placeholder="Reason (optional, helps improve the AI)"
            maxLength={255}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={busy || priority === r.priority}>
              Save priority
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LandlordActions({ request: r, onChanged }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = NEXT_STATUS[r.status];
  if (next.length === 0) return null;

  async function move(status) {
    setBusy(true);
    setError("");
    try {
      await api(`/requests/${r.id}/status`, { method: "PATCH", body: { status, note: note.trim() || undefined } });
      setNote("");
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="font-semibold">Update status</p>
      {error && <Alert>{error}</Alert>}
      <input
        id="status-note"
        className="input"
        placeholder="Note for the tenant (optional), e.g. Plumber coming at 9am"
        maxLength={255}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <button key={s} disabled={busy} onClick={() => move(s)} className={`btn flex-1 ${s === "CANCELLED" ? "btn-danger" : "btn-primary"}`}>
            {NEXT_STATUS_ACTION[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

function TenantCancel({ request: r, onChanged }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    try {
      await api(`/requests/${r.id}/status`, { method: "PATCH", body: { status: "CANCELLED" } });
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-2">
      {error && <Alert>{error}</Alert>}
      {confirming ? (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <p className="flex-1 text-sm">Cancel this request?</p>
          <button className="btn btn-danger py-2 text-sm" onClick={cancel}>
            Yes, cancel it
          </button>
          <button className="btn btn-secondary py-2 text-sm" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button className="btn btn-secondary w-full text-sm" onClick={() => setConfirming(true)}>
          Cancel this request
        </button>
      )}
    </div>
  );
}

// Status history plus priority changes, oldest first.
function Timeline({ request: r }) {
  const events = [
    ...r.history.map((h) => ({
      at: h.createdAt,
      title: STATUS[h.toStatus]?.label ?? h.toStatus,
      by: h.changedBy.name,
      note: h.note,
      status: h.toStatus,
    })),
    ...r.overrides.map((o) => ({
      at: o.createdAt,
      title: `Priority changed from ${PRIORITY[o.fromPriority].label} to ${PRIORITY[o.toPriority].label}`,
      by: o.changedBy.name,
      note: o.reason,
    })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  return (
    <div className="card p-4">
      <p className="mb-3 font-semibold">Progress</p>
      <ol className="relative space-y-4 border-l-2 border-line pl-5">
        {events.map((e, i) => (
          <li key={i} className="relative">
            <span
              className={`absolute top-1 -left-[27px] size-3 rounded-full border-2 border-white ${i === events.length - 1 ? "bg-brand-600" : "bg-slate-300"}`}
            />
            <p className="text-sm font-semibold">{e.title}</p>
            <p className="text-xs text-muted">
              {formatDate(e.at)} · {e.by}
            </p>
            {e.note && <p className="mt-1 text-sm">{e.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
