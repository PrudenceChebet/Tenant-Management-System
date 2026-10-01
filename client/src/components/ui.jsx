import { useEffect, useState } from "react";
import { PRIORITY, STATUS } from "../lib/format.js";

export function StatusChip({ status }) {
  const s = STATUS[status] ?? { label: status, className: "bg-slate-100" };
  return <span className={`chip ${s.className}`}>{s.label}</span>;
}

export function PriorityChip({ priority }) {
  const p = PRIORITY[priority];
  if (!p) return null;
  return <span className={`chip ${p.className}`}>{p.label}</span>;
}

export function Field({ label, error, hint, children }) {
  return (
    <div>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p className="mt-1 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function Alert({ kind = "error", children }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={`rounded-xl border px-3.5 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="card px-5 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

// true/false that follows the phone's connection.
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
