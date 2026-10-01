import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../lib/auth.jsx";
import { fieldErrors } from "../lib/api.js";
import { Alert, Field } from "../components/ui.jsx";
import { AuthShell } from "./LoginPage.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "TENANT" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      await register({ ...form, phone: form.phone || undefined });
      navigate("/", { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create an account">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <div>
          <span className="label">I am a</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["TENANT", "Tenant"],
              ["LANDLORD", "Landlord"],
            ].map(([value, label]) => (
              <label
                key={value}
                className={`btn cursor-pointer border ${form.role === value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white"}`}
              >
                <input type="radio" name="role" value={value} checked={form.role === value} onChange={update("role")} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <Field label="Full name" error={errors.name}>
          <input id="name" className="input" autoComplete="name" value={form.name} onChange={update("name")} required />
        </Field>
        <Field label="Email" error={errors.email}>
          <input id="reg-email" className="input" type="email" autoComplete="email" value={form.email} onChange={update("email")} required />
        </Field>
        <Field label="Phone (optional)" error={errors.phone}>
          <input id="phone" className="input" type="tel" autoComplete="tel" placeholder="07..." value={form.phone} onChange={update("phone")} />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters">
          <input id="reg-password" className="input" type="password" autoComplete="new-password" value={form.password} onChange={update("password")} required />
        </Field>

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        {form.role === "TENANT" && (
          <p className="text-sm text-muted">After signing up, ask your landlord to link your account to your unit.</p>
        )}
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-700">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
