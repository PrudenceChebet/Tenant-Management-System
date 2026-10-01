import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../lib/auth.jsx";
import { Alert, Field } from "../components/ui.jsx";

// Demo accounts from the seed data, for quick testing and the project demo.
const DEMO = [
  { label: "Tenant (Brian, A1)", email: "brian@tms.test" },
  { label: "Tenant (Faith, A2)", email: "faith@tms.test" },
  { label: "Landlord (Grace)", email: "landlord@tms.test" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e, creds = { email, password }) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(creds.email, creds.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Log in" subtitle="Report and track repairs in your rental unit.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Email">
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        New tenant or landlord?{" "}
        <Link to="/register" className="font-semibold text-brand-700">
          Create an account
        </Link>
      </p>

      <div className="mt-8 border-t border-line pt-5">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Demo accounts</p>
        <div className="grid gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              disabled={busy}
              onClick={() => submit(null, { email: d.email, password: "Password123" })}
              className="btn btn-secondary justify-between py-2.5 text-sm"
            >
              <span>{d.label}</span>
              <span className="font-normal text-muted">{d.email}</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-3">
        <img src="/pwa-192.png" alt="" className="size-11 rounded-xl" />
        <div>
          <p className="text-lg font-bold leading-tight">TMS</p>
          <p className="text-sm text-muted">Tenant maintenance</p>
        </div>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className="mt-1 mb-6 text-muted">{subtitle}</p>}
      {children}
    </div>
  );
}
