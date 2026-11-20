import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { scoutingApi } from "../api/endpoints";
import { useSubmission, useSubmissions, useTemplateVersion, useTemplates } from "../api/hooks";
import { api, ApiError } from "../api/client";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  TableWrap,
  Td,
  Th,
  formatDateTime,
} from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

export default function ScoutingResults() {
  const [event, setEvent] = useState("");
  const [team, setTeam] = useState("");
  const [match, setMatch] = useState("");
  const [template, setTemplate] = useState("");
  const { data, isLoading, isError, error, refetch } = useSubmissions({
    event: event || undefined,
    team: team ? Number(team) : undefined,
    match: match || undefined,
    template: template ? Number(template) : undefined,
  });
  const templates = useTemplates(true);
  const { user } = useAuth();

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      if (event) params.set("event", event);
      if (team) params.set("team", team);
      if (match) params.set("match", match);
      if (template) params.set("template", template);
      const res = await api.fetch(`/scouting/submissions/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scouting-submissions.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Export failed.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Scouting results</h1>
          <p className="mt-1 text-slate-600">
            All submitted reports. Multiple scouts may record separate observations for the same
            team and match.
          </p>
        </div>
        {can(user, "view_scouting_results") && (
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        )}
      </header>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="search"
            placeholder="Filter by event…"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            aria-label="Filter by event"
          />
          <Input
            type="number"
            placeholder="Team number…"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            aria-label="Filter by team number"
          />
          <Input
            type="search"
            placeholder="Match (e.g. qm12)…"
            value={match}
            onChange={(e) => setMatch(e.target.value)}
            aria-label="Filter by match"
          />
          <Select value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="Filter by template">
            <option value="">All templates</option>
            {templates.data?.items.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading && <LoadingState />}
        {isError && <ErrorState message={error.message} retry={() => refetch()} />}
        {data && data.items.length === 0 && (
          <EmptyState
            title="No submissions found"
            description="Try clearing the filters."
            action={
              <Link to="/app/scouting">
                <Button variant="secondary" size="sm">
                  Submit scouting data
                </Button>
              </Link>
            }
          />
        )}
        {data && data.items.length > 0 && (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Event</Th>
                <Th>Team</Th>
                <Th>Match</Th>
                <Th>Template</Th>
                <Th>Scout</Th>
                <Th className="sr-only">Open</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-600">{formatDateTime(s.created_at)}</Td>
                  <Td className="font-medium text-slate-900">{s.event_name}</Td>
                  <Td>{s.team_number}</Td>
                  <Td>{s.match_key ?? "—"}</Td>
                  <Td>
                    {s.template_name} <span className="text-xs text-slate-400">v{s.template_version}</span>
                  </Td>
                  <Td className="text-slate-600">{s.author}</Td>
                  <Td>
                    <Link
                      to={`/app/scouting/results/${s.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      View
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

export function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const submission = useSubmission(Number(id));
  const version = useTemplateVersion(
    submission.data?.template_id ?? 0,
    submission.data?.template_version ?? 0,
  );

  if (submission.isLoading) return <LoadingState />;
  if (submission.isError) {
    return <ErrorState message={submission.error.message} retry={() => submission.refetch()} />;
  }
  const s = submission.data!;

  return (
    <div className="space-y-4">
      <Link to="/app/scouting/results" className="text-sm text-brand-700 hover:underline">
        ← Back to results
      </Link>
      <Card>
        <CardHeader
          title={`Team ${s.team_number} — ${s.event_name}${s.match_key ? ` (${s.match_key})` : ""}`}
          description={`Scouted by ${s.author} · ${formatDateTime(s.created_at)} · ${
            s.template_name
          } (v${s.template_version})`}
        />
        {version.isLoading && <LoadingState />}
        {version.data && (
          <dl className="divide-y divide-slate-100">
            {version.data.fields.map((f) => {
              const value = s.answers?.[f.field_key];
              const display =
                value === undefined || value === null || value === ""
                  ? "—"
                  : Array.isArray(value)
                    ? value.join(", ")
                    : typeof value === "boolean"
                      ? value
                        ? "Yes"
                        : "No"
                      : String(value);
              return (
                <div key={f.field_key} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:px-6">
                  <dt className="text-sm font-medium text-slate-600">
                    {f.label}
                    {f.required && <span className="ml-1 text-red-600">*</span>}
                  </dt>
                  <dd className="text-sm text-slate-900 sm:col-span-2">{display}</dd>
                </div>
              );
            })}
          </dl>
        )}
        {!version.data && !version.isLoading && (
          <Alert tone="warning" title="Template snapshot unavailable">
            The version snapshot for this submission could not be loaded, but the answers are
            preserved.
          </Alert>
        )}
      </Card>
    </div>
  );
}
