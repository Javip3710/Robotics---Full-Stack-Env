import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { can, canAccessInventory } from "../auth/permissions";
import { useEvents, useMembers, useNews, useSubmissions } from "../api/hooks";
import {
  Alert,
  Card,
  LoadingState,
  RoleBadge,
  StatusBadge,
  formatDate,
  formatDateTime,
} from "../components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const news = useNews(can(user, "publish_news"));
  const events = useEvents(true);
  const members = useMembers("pending", "");
  const mySubmissions = useSubmissions({});

  const quickLinks = [
    { to: "/app/events", label: "Manage events", show: can(user, "manage_events") },
    { to: "/app/news/new", label: "Write a news post", show: can(user, "publish_news") },
    { to: "/app/scouting", label: "Submit scouting data", show: user.status === "approved" },
    { to: "/app/scouting/results", label: "View scouting results", show: user.status === "approved" },
    { to: "/app/members", label: "Member directory", show: user.status === "approved" },
    { to: "/app/docs", label: "Internal documentation", show: user.status === "approved" },
    { to: "/app/inventory", label: "Inventory", show: canAccessInventory(user) },
    {
      to: "/app/scouting/templates",
      label: "Manage scouting templates",
      show: can(user, "manage_scouting_templates"),
    },
  ].filter((l) => l.show);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Welcome back, {user.name.split(" ")[0]}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <RoleBadge role={user.role} />
          <StatusBadge status={user.status} />
        </div>
      </header>

      {user.status === "pending" && (
        <Alert tone="info" title="Membership pending approval">
          A mentor or captain needs to approve your account before you can access team content.
        </Alert>
      )}
      {user.status === "suspended" && (
        <Alert tone="error" title="Membership suspended">
          Your access is currently suspended. Contact a mentor or captain.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick links */}
        <Card className="p-6">
          <h2 className="font-semibold">Quick links</h2>
          <div className="mt-4 grid gap-2">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-gold-400 hover:bg-gold-50"
              >
                {link.label}
              </Link>
            ))}
            {quickLinks.length === 0 && (
              <p className="text-sm text-slate-500">No links available for your account yet.</p>
            )}
          </div>
        </Card>

        {/* Upcoming events */}
        <Card className="p-6">
          <h2 className="font-semibold">Upcoming events</h2>
          {events.isLoading && <LoadingState />}
          <div className="mt-4 space-y-3">
            {events.data?.items.slice(0, 4).map((event) => (
              <div key={event.id} className="border-l-2 border-gold-400 pl-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {formatDate(event.date)}
                </p>
                <p className="font-medium text-slate-800">{event.name}</p>
                {event.location && <p className="text-xs text-slate-500">{event.location}</p>}
              </div>
            ))}
            {events.data && events.data.items.length === 0 && (
              <p className="text-sm text-slate-500">No upcoming events scheduled.</p>
            )}
          </div>
        </Card>

        {/* Pending approvals (managers) */}
        {can(user, "approve_members") && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pending members</h2>
              <Link to="/app/members?status=pending" className="text-sm text-brand-700 hover:underline">
                Review all
              </Link>
            </div>
            {members.isLoading && <LoadingState />}
            <div className="mt-4 space-y-2">
              {members.data?.items.slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800">{m.name}</span>
                  <StatusBadge status={m.status} />
                </div>
              ))}
              {members.data && members.data.items.length === 0 && (
                <p className="text-sm text-slate-500">No pending members.</p>
              )}
            </div>
          </Card>
        )}

        {/* My recent submissions */}
        {user.status === "approved" && (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recent scouting submissions</h2>
              <Link
                to="/app/scouting/results"
                className="text-sm text-brand-700 hover:underline"
              >
                View all
              </Link>
            </div>
            {mySubmissions.isLoading && <LoadingState />}
            <div className="mt-4 space-y-2">
              {mySubmissions.data?.items.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-800">
                    Team {s.team_number} · {s.event_name}
                    {s.match_key ? ` (${s.match_key})` : ""}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(s.created_at)}
                  </span>
                </div>
              ))}
              {mySubmissions.data && mySubmissions.data.items.length === 0 && (
                <p className="text-sm text-slate-500">
                  No submissions yet —{" "}
                  <Link to="/app/scouting" className="text-brand-700 hover:underline">
                    record your first scout
                  </Link>
                  .
                </p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Latest news */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Latest news</h2>
          {can(user, "publish_news") && (
            <Link to="/app/news/new" className="text-sm text-brand-700 hover:underline">
              + New post
            </Link>
          )}
        </div>
        {news.isLoading && <LoadingState />}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {news.data?.items.slice(0, 4).map((post) => (
            <Link
              key={post.id}
              to={`/news/${post.id}`}
              className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-gold-400"
            >
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {formatDate(post.published_at)}
                {!post.published && (
                  <span className="rounded bg-yellow-100 px-1.5 py-0.5 font-medium text-yellow-800">
                    Draft
                  </span>
                )}
              </div>
              <p className="mt-1 font-medium text-slate-900">{post.title}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{post.summary}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
