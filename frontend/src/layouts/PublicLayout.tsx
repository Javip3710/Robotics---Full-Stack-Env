import { useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { TeamLogo, TeamWordmark } from "../components/TeamLogo";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../components/ui";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About the team" },
  { to: "/docs", label: "Documentation" },
];

export default function PublicLayout({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-gold-600 bg-gold-400">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2.5 text-brand-600" aria-label="Team home">
            <TeamLogo className="h-8 w-8" />
            <TeamWordmark />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    isActive ? "bg-brand-600 text-white" : "text-brand-600 hover:bg-gold-200",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <Link
                to="/app"
                className="ml-2 rounded-lg border border-gold-500 bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
              >
                Open portal
              </Link>
            ) : (
              <Link
                to="/signin"
                className="ml-2 rounded-lg border border-gold-500 bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
              >
                Sign in
              </Link>
            )}
          </nav>

          {/* Mobile toggle */}
          <button
            className="rounded-lg p-2 text-brand-600 hover:bg-gold-200 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <nav className="border-t border-gold-600 bg-gold-400 px-4 pb-3 pt-2 md:hidden" aria-label="Mobile">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium",
                    isActive ? "bg-brand-600 text-white" : "text-brand-600 hover:bg-gold-200",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to={user ? "/app" : "/signin"}
              onClick={() => setMobileOpen(false)}
              className="mt-2 block rounded-lg border border-gold-500 bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white"
            >
              {user ? "Open portal" : "Sign in"}
            </Link>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gold-600 bg-gold-400 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-sm font-medium text-brand-700">
          <span>Robo-Nerds — FRC Team 5089 · Benjamin Franklin High School, Los Angeles</span>
          <span>
            Built for the team · <Link to="/docs" className="underline hover:text-brand-600">Documentation</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
