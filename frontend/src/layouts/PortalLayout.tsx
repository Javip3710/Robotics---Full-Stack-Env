import { useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { TeamLogo, TeamWordmark } from "../components/TeamLogo";
import { useAuth } from "../auth/AuthContext";
import { can, canAccessInventory } from "../auth/permissions";
import { RoleBadge, StatusBadge, cn } from "../components/ui";

export default function PortalLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  const links: { to: string; label: string; show: boolean; icon: ReactNode }[] = [

    {
      to: "/app",
      label: "Dashboard",
      show: true,
      icon: <path d="M3 12l9-8 9 8M5 10v10h14V10" />,
    },
    {
      to: "/app/events",
      label: "Events",
      show: can(user, "manage_events"),
      icon: <path d="M8 2v4M16 2v4M3 10h18M3 5h18v16H3z" />,
    },
    {
      to: "/app/members",
      label: "Members",
      show: true,
      icon: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
    },
    {
      to: "/app/docs",
      label: "Documentation",
      show: true,
      icon: <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z" />,
    },
    {
      to: "/app/scouting",
      label: "Scouting",
      show: true,
      icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
    },
    {
      to: "/app/scouting/results",
      label: "Scouting results",
      show: true,
      icon: <path d="M18 20V10M12 20V4M6 20v-6" />,
    },
    {
      to: "/app/scouting/templates",
      label: "Templates",
      show: can(user, "manage_scouting_templates"),
      icon: <path d="M12 4v16m8-8H4" />,
    },
    {
      to: "/app/inventory",
      label: "Inventory",
      show: canAccessInventory(user),
      icon: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    },
  ];

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Team portal
      </p>
      {links
        .filter((l) => l.show)
        .map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/app"}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-gold-400 text-brand-700"
                  : "text-slate-200 hover:bg-brand-700 hover:text-white",
              )
            }
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icon}
            </svg>
            {label}
          </NavLink>
        ))}

      <div className="mt-auto space-y-3 border-t border-brand-700 pt-3">
        <div className="rounded-lg bg-brand-700 p-3">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-brand-700 hover:text-white"
        >
          Sign out
        </button>
        <Link
          to="/"
          className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-brand-700 hover:text-white"
        >
          ← Public website
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-brand-600 lg:block">
        <div className="flex items-center gap-2.5 border-b border-brand-700 px-4 py-4 text-gold-400">
          <TeamLogo className="h-8 w-8" />
          <TeamWordmark dark />
        </div>
        <div className="h-[calc(100vh-65px)] overflow-y-auto">{sidebar}</div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-brand-700 bg-brand-600 px-4 lg:hidden">
          <div className="flex items-center gap-2 text-gold-400">
            <TeamLogo className="h-7 w-7" />
            <TeamWordmark dark />
          </div>
          <button
            className="rounded-lg p-2 text-slate-200 hover:bg-brand-700"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-expanded={sidebarOpen}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {sidebarOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </header>
        {sidebarOpen && (
          <div className="fixed inset-0 top-14 z-20 bg-brand-600 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div
              className="h-full w-72 bg-brand-600 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebar}
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
