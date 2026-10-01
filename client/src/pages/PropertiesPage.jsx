import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Alert, EmptyState, Spinner } from "../components/ui.jsx";

// Landlord: properties, their units, and which tenant lives in each.
export default function PropertiesPage() {
  const [properties, setProperties] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setProperties((await api("/properties")).properties);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!properties) return error ? <Alert>{error}</Alert> : <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">Properties</h1>
        {!adding && (
          <button className="btn btn-primary py-2.5 text-sm" onClick={() => setAdding(true)}>
            Add property
          </button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      {adding && <AddProperty onDone={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}
      {properties.length === 0 && !adding && <EmptyState title="No properties yet">Add your first property to get started.</EmptyState>}
      {properties.map((p) => (
        <Property key={p.id} property={p} onChanged={load} />
      ))}
    </div>
  );
}

function AddProperty({ onDone, onCancel }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      await api("/properties", { method: "POST", body: { name, location } });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-4">
      <p className="font-semibold">New property</p>
      {error && <Alert>{error}</Alert>}
      <input id="prop-name" className="input" placeholder="Name, e.g. Kimathi Court" value={name} onChange={(e) => setName(e.target.value)} required />
      <input id="prop-location" className="input" placeholder="Location, e.g. Nyeri, Kamakwa Road" value={location} onChange={(e) => setLocation(e.target.value)} required />
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1">Save</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Property({ property: p, onChanged }) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const occupied = p.units.filter((u) => u.tenant).length;

  async function addUnit(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/properties/${p.id}/units`, { method: "POST", body: { label } });
      setLabel("");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <p className="font-semibold">{p.name}</p>
        <p className="text-sm text-muted">
          {p.location} · {occupied} of {p.units.length} units occupied
        </p>
      </div>
      <ul className="divide-y divide-line">
        {p.units.map((u) => (
          <Unit key={u.id} unit={u} onChanged={onChanged} />
        ))}
      </ul>
      <form onSubmit={addUnit} className="flex gap-2 border-t border-line bg-ground/60 px-4 py-3">
        <input
          id={`unit-label-${p.id}`}
          className="input py-2"
          placeholder="New unit, e.g. C1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          maxLength={20}
        />
        <button className="btn btn-secondary py-2 text-sm whitespace-nowrap">Add unit</button>
      </form>
      {error && (
        <div className="px-4 pb-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </section>
  );
}

function Unit({ unit: u, onChanged }) {
  const [linking, setLinking] = useState(false);
  const [confirmVacate, setConfirmVacate] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function setTenant(tenantEmail) {
    setError("");
    try {
      await api(`/units/${u.id}/tenant`, { method: "PUT", body: { tenantEmail } });
      setLinking(false);
      setConfirmVacate(false);
      setEmail("");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">Unit {u.label}</p>
          <p className="truncate text-sm text-muted">{u.tenant ? `${u.tenant.name} · ${u.tenant.email}` : "Vacant"}</p>
        </div>
        {u.tenant ? (
          confirmVacate ? (
            <div className="flex shrink-0 gap-3 text-sm font-medium">
              <button className="text-red-700" onClick={() => setTenant(null)}>
                Yes, remove
              </button>
              <button className="text-muted" onClick={() => setConfirmVacate(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button className="shrink-0 text-sm font-medium text-red-700" onClick={() => setConfirmVacate(true)}>
              Mark vacant
            </button>
          )
        ) : (
          !linking && (
            <button className="text-sm font-medium text-brand-700" onClick={() => setLinking(true)}>
              Add tenant
            </button>
          )
        )}
      </div>
      {linking && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTenant(email);
          }}
          className="mt-3 space-y-2"
        >
          <input
            id={`tenant-email-${u.id}`}
            className="input py-2"
            type="email"
            placeholder="Tenant's account email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <p className="text-xs text-muted">The tenant must create their account in the app first.</p>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 py-2 text-sm">Link tenant</button>
            <button type="button" className="btn btn-secondary py-2 text-sm" onClick={() => setLinking(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </li>
  );
}
