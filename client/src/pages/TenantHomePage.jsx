import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../lib/auth.jsx";
import { useRequests } from "../lib/useRequests.js";
import { discard, retry, useQueue } from "../lib/offlineQueue.js";
import { categoryLabel, timeAgo } from "../lib/format.js";
import RequestCard from "../components/RequestCard.jsx";
import { Alert, EmptyState, Spinner, StatusChip } from "../components/ui.jsx";

export default function TenantHomePage() {
  const { user, refresh } = useAuth();
  const { requests, error, reload } = useRequests();
  const queued = useQueue(user.id);
  const flash = useLocation().state?.flash;

  // A queued request disappears from the outbox once it's sent; reload then.
  const queuedIds = queued.map((q) => q.clientId).join(",");
  useQueueChange(queuedIds, reload);

  // Pick up a newly linked unit without logging out and in again.
  useEffect(() => {
    if (user.unit) return;
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [user.unit, refresh]);

  const open = requests?.filter((r) => ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"].includes(r.status)) ?? [];
  const closed = requests?.filter((r) => !open.includes(r)) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">My requests</h1>
        {user.unit && (
          <Link to="/new" className="btn btn-primary py-2.5 text-sm">
            Report an issue
          </Link>
        )}
      </div>

      {flash && <Alert kind={flash.kind}>{flash.text}</Alert>}
      {!user.unit && (
        <Alert kind="info">
          Your account isn't linked to a unit yet. Ask your landlord to add <strong>{user.email}</strong> to your unit. This page
          updates by itself once they do.
        </Alert>
      )}
      {error && requests && <Alert>{error}</Alert>}

      {queued.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Not sent yet</h2>
          {queued.map((q) => (
            <div key={q.clientId} className="card border-dashed px-4 py-3.5">
              <p className="font-semibold">{q.title}</p>
              <p className="mt-1 text-sm text-muted">
                {q.requestId ? "Report sent, photos waiting" : categoryLabel(q.category)}
                {q.photos?.length ? ` · ${q.photos.length} photo${q.photos.length === 1 ? "" : "s"}` : ""} · saved {timeAgo(q.queuedAt)}
              </p>
              {q.error ? (
                <div className="mt-2.5 space-y-2">
                  <p className="text-sm font-medium text-red-700">Couldn't send: {q.error}</p>
                  <div className="flex gap-2">
                    <button className="btn btn-secondary py-2 text-sm" onClick={() => retry(q.clientId)}>
                      Try again
                    </button>
                    <button className="btn btn-danger py-2 text-sm" onClick={() => discard(q.clientId)}>
                      Discard
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5">
                  <StatusChip status="QUEUED" />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {!requests && !error && <Spinner />}
      {!requests && error && <Alert>{error}</Alert>}

      {requests && open.length === 0 && queued.length === 0 && (
        <EmptyState title="No open requests">
          {user.unit ? "When something in your unit needs fixing, tap Report an issue." : null}
        </EmptyState>
      )}

      {open.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Open</h2>
          {open.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </section>
      )}

      {closed.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Closed</h2>
          {closed.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </section>
      )}
    </div>
  );
}

// Runs onChange whenever key changes (but not on the first render).
function useQueueChange(key, onChange) {
  const prev = useRef(key);
  useEffect(() => {
    if (prev.current !== key) onChange();
    prev.current = key;
  }, [key, onChange]);
}
