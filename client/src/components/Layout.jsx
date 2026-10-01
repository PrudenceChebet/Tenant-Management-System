import { NavLink, Outlet } from "react-router";
import { useAuth } from "../lib/auth.jsx";
import { useOnline } from "./ui.jsx";

// Frame around every logged-in screen: top bar, offline banner, bottom tabs.
export default function Layout() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const isLandlord = user.role === "LANDLORD";

  const tabs = isLandlord
    ? [
        { to: "/", label: "Requests", icon: ListIcon, end: true },
        { to: "/properties", label: "Properties", icon: HomeIcon },
      ]
    : [
        { to: "/", label: "My requests", icon: ListIcon, end: true },
        { to: "/new", label: "Report issue", icon: PlusIcon },
      ];

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/pwa-192.png" alt="" className="size-8 rounded-lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{user.name}</p>
              <p className="truncate text-xs text-muted">
                {isLandlord ? "Landlord" : user.unit ? `${user.unit.property.name}, ${user.unit.label}` : "No unit linked yet"}
              </p>
            </div>
          </div>
          <button onClick={logout} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-ground">
            Log out
          </button>
        </div>
        {!online && (
          <div className="bg-slate-800 px-4 py-2 text-sm text-white">
            You're offline. {isLandlord ? "Showing the last saved list." : "New reports will be sent when you're back online."}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-xl">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${isActive ? "text-brand-700" : "text-muted"}`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

const iconProps = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const ListIcon = () => (
  <svg {...iconProps}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </svg>
);
const PlusIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const HomeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v10h14V10" />
  </svg>
);
