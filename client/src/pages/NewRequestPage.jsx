import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "../lib/auth.jsx";
import { api, fieldErrors, newId } from "../lib/api.js";
import { enqueue } from "../lib/offlineQueue.js";
import { CATEGORIES, PRIORITY, prioritySourceText } from "../lib/format.js";
import { Alert, Field } from "../components/ui.jsx";

// Objective 1: tenants report issues in a structured way (category,
// location, description), and it still works without a connection.
export default function NewRequestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ category: "", title: "", locationInUnit: "", description: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user.unit) return <Navigate to="/" replace />;

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!form.category) {
      setErrors({ category: "Pick the type of problem" });
      return;
    }
    setBusy(true);
    setError("");
    setErrors({});

    const body = {
      clientId: newId(),
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
      locationInUnit: form.locationInUnit.trim() || undefined,
      reportedAt: new Date().toISOString(),
    };

    const saveOffline = async () => {
      await enqueue(user.id, body);
      navigate("/", {
        state: { flash: { kind: "info", text: "You're offline, so your report is saved on this phone. It will be sent automatically when you're back online." } },
      });
    };

    if (!navigator.onLine) return saveOffline();

    try {
      const { request } = await api("/requests", { method: "POST", body });
      const p = PRIORITY[request.priority].label.toLowerCase();
      navigate(`/requests/${request.id}`, {
        state: { flash: { kind: "success", text: `Report sent. Priority: ${p}. ${prioritySourceText(request)}.` } },
      });
    } catch (err) {
      if (err.network) return saveOffline();
      setErrors(fieldErrors(err));
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Report an issue</h1>
        <p className="mt-1 text-muted">
          {user.unit.property.name}, unit {user.unit.label}
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Field label="What type of problem is it?" error={errors.category}>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <label
              key={c.value}
              className={`card cursor-pointer px-3 py-2.5 transition ${form.category === c.value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : ""}`}
            >
              <input type="radio" name="category" value={c.value} checked={form.category === c.value} onChange={update("category")} className="sr-only" />
              <span className="block text-sm font-semibold">{c.label}</span>
              <span className="block text-xs text-muted">{c.hint}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Short title" error={errors.title} hint="For example: Kitchen sink leaking">
        <input id="title" className="input" maxLength={120} value={form.title} onChange={update("title")} required />
      </Field>

      <Field label="Where in the unit? (optional)" error={errors.locationInUnit}>
        <input id="location" className="input" maxLength={60} placeholder="Kitchen, bathroom, bedroom…" value={form.locationInUnit} onChange={update("locationInUnit")} />
      </Field>

      <Field
        label="Describe the problem"
        error={errors.description}
        hint="What happened, since when, and is it getting worse? More detail helps get the right priority."
      >
        <textarea id="description" className="input min-h-32" maxLength={2000} value={form.description} onChange={update("description")} required />
      </Field>

      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
