import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { scoutingApi } from "../api/endpoints";
import { useEvents, useTemplates } from "../api/hooks";
import { ApiError } from "../api/client";
import type { FieldDef, Template } from "../api/types";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Label,
  LoadingState,
  Select,
  Textarea,
  formatDateTime,
} from "../components/ui";

type Answers = Record<string, unknown>;

/** Client-side validation — mirrors backend/permissions + scouting validation. */
function validateField(field: FieldDef, value: unknown): string | undefined {
  const empty =
    value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  if (field.required && empty) return "This field is required.";
  if (empty) return undefined;
  switch (field.field_type) {
    case "short_text":
    case "long_text":
      return typeof value === "string" ? undefined : "Must be text.";
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) return "Must be a number.";
      if (field.min_value !== null && value < field.min_value)
        return `Must be at least ${field.min_value}.`;
      if (field.max_value !== null && value > field.max_value)
        return `Must be at most ${field.max_value}.`;
      return undefined;
    }
    case "checkbox":
      return typeof value === "boolean" ? undefined : "Must be checked or unchecked.";
    case "single_select":
      return field.options.includes(value as string) ? undefined : "Choose one of the options.";
    case "multi_select":
      return Array.isArray(value) && (value as unknown[]).every((v) => field.options.includes(v as string))
        ? undefined
        : "Choose only from the listed options.";
    default:
      return undefined;
  }
}

export default function ScoutingSubmit() {
  const events = useEvents(false);
  const templates = useTemplates(false);

  // Step 1 — match context
  const [eventName, setEventName] = useState("");
  const [teamNumber, setTeamNumber] = useState("");
  const [matchKey, setMatchKey] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);

  // Step 2 — answers
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 3 — submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{ id: number } | null>(null);

  const template: Template | undefined = useMemo(
    () => templates.data?.items.find((t) => t.id === templateId),
    [templates.data, templateId],
  );
  const fields = template?.fields ?? [];

  const contextValid =
    eventName.trim().length >= 2 && Number(teamNumber) >= 1 && templateId !== null;

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function validateAll(): boolean {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      const err = validateField(field, answers[field.field_key]);
      if (err) errs[field.field_key] = err;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateAll() || !templateId) return;
    if (
      !window.confirm(
        `Submit this scouting report for team ${teamNumber}${
          matchKey ? ` (${matchKey})` : ""
        }? You can edit it afterwards if needed.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setServerDetails({});
    try {
      const submission = await scoutingApi.createSubmission({
        event_name: eventName.trim(),
        team_number: Number(teamNumber),
        match_key: matchKey.trim() || null,
        template_id: templateId,
        answers,
      });
      setSuccess({ id: submission.id });
    } catch (err) {
      // Keep all entered data on failure.
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        if (err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, value] of Object.entries(err.details)) {
            if (key.startsWith("answers.")) fieldErrors[key.slice(8)] = value;
          }
          setServerDetails(fieldErrors);
        }
      } else {
        setSubmitError("Could not reach the server. Your input is preserved — try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // --- Success screen ---------------------------------------------------------
  if (success) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold">Submission saved</h1>
          <p className="mt-2 text-slate-600">
            Your scouting report for team {teamNumber} was recorded. Thank you.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSuccess(null);
                setAnswers({});
                setErrors({});
                setTeamNumber("");
                setMatchKey("");
              }}
            >
              Scout another team
            </Button>
            <Link to="/app/scouting/results">
              <Button variant="ghost">View results</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6" noValidate>
      <header>
        <h1 className="text-2xl font-bold">Submit scouting data</h1>
        <p className="mt-1 text-slate-600">
          Record what you observed. Large controls on purpose — this form is designed for phones.
        </p>
      </header>

      {/* Step 1: match context */}
      <Card>
        <CardHeader title="1 · Match information" description="Which team did you watch?" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <Field label="Event" htmlFor="event" required help="Choose an event or type a new one.">
            <Input
              id="event"
              list="event-options"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Regional Event"
              required
            />
            <datalist id="event-options">
              {events.data?.items.map((ev) => (
                <option key={ev.id} value={ev.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Scouting template" htmlFor="template" required>
            <Select
              id="template"
              value={templateId ?? ""}
              onChange={(e) => {
                setTemplateId(Number(e.target.value) || null);
                setAnswers({});
                setErrors({});
              }}
              required
            >
              <option value="">Select a template…</option>
              {templates.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.version})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Team number" htmlFor="team" required>
            <Input
              id="team"
              type="number"
              min={1}
              inputMode="numeric"
              value={teamNumber}
              onChange={(e) => setTeamNumber(e.target.value)}
              placeholder="e.g. 254"
              required
            />
          </Field>
          <Field label="Match (optional)" htmlFor="match" help="e.g. qm12 — leave blank for pit scouting.">
            <Input
              id="match"
              value={matchKey}
              onChange={(e) => setMatchKey(e.target.value)}
              placeholder="qm12"
            />
          </Field>
        </div>
      </Card>

      {/* Step 2: the form */}
      {template && (
        <Card>
          <CardHeader
            title="2 · Report"
            description={`${template.name} — version ${template.version} (recorded with this submission)`}
          />
          {fields.length === 0 && (
            <p className="p-6 text-sm text-slate-600">
              This template has no fields. Contact a mentor or captain.
            </p>
          )}
          <div className="space-y-6 p-4 sm:p-6">
            {fields.map((field) => {
              const error = errors[field.field_key] ?? serverDetails[field.field_key];
              const id = `field-${field.field_key}`;
              const value = answers[field.field_key];
              return (
                <Field
                  key={field.field_key}
                  label={field.label}
                  htmlFor={id}
                  required={field.required}
                  help={field.help_text}
                  error={error}
                >
                  {field.field_type === "short_text" && (
                    <Input
                      id={id}
                      value={(value as string) ?? ""}
                      onChange={(e) => setAnswer(field.field_key, e.target.value)}
                    />
                  )}
                  {field.field_type === "long_text" && (
                    <Textarea
                      id={id}
                      value={(value as string) ?? ""}
                      onChange={(e) => setAnswer(field.field_key, e.target.value)}
                      className="text-base"
                    />
                  )}
                  {field.field_type === "number" && (
                    <Input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min={field.min_value ?? undefined}
                      max={field.max_value ?? undefined}
                      value={(value as number) ?? ""}
                      onChange={(e) =>
                        setAnswer(field.field_key, e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="text-lg"
                    />
                  )}
                  {field.field_type === "checkbox" && (
                    <Checkbox
                      id={id}
                      label={field.help_text || "Yes"}
                      checked={(value as boolean) ?? false}
                      onChange={(e) => setAnswer(field.field_key, e.target.checked)}
                    />
                  )}
                  {field.field_type === "single_select" && (
                    <Select
                      id={id}
                      value={(value as string) ?? ""}
                      onChange={(e) => setAnswer(field.field_key, e.target.value)}
                    >
                      <option value="">Select…</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  )}
                  {field.field_type === "multi_select" && (
                    <fieldset className="space-y-2">
                      <legend className="sr-only">{field.label}</legend>
                      {field.options.map((opt) => {
                        const selected = Array.isArray(value) && (value as string[]).includes(opt);
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-base"
                          >
                            <input
                              type="checkbox"
                              className="h-6 w-6 rounded border-slate-300 text-brand-600"
                              checked={selected}
                              onChange={(e) => {
                                const current = Array.isArray(value) ? (value as string[]) : [];
                                setAnswer(
                                  field.field_key,
                                  e.target.checked
                                    ? [...current, opt]
                                    : current.filter((v) => v !== opt),
                                );
                              }}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </fieldset>
                  )}
                </Field>
              );
            })}
          </div>
        </Card>
      )}

      {/* Step 3: review + submit */}
      {contextValid && template && (
        <Card>
          <CardHeader title="3 · Review and submit" />
          <div className="space-y-4 p-4 sm:p-6">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Event</dt>
                <dd className="font-medium">{eventName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Team</dt>
                <dd className="font-medium">{teamNumber}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Match</dt>
                <dd className="font-medium">{matchKey || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Template</dt>
                <dd className="font-medium">
                  {template.name} (v{template.version})
                </dd>
              </div>
            </dl>
            <div>
              <Label>Summary</Label>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
                {fields.map((f) => {
                  const v = answers[f.field_key];
                  const display =
                    v === undefined || v === null || v === ""
                      ? "—"
                      : Array.isArray(v)
                        ? v.join(", ")
                        : String(v);
                  return (
                    <li key={f.field_key}>
                      <span className="text-slate-500">{f.label}:</span> {display}
                    </li>
                  );
                })}
              </ul>
            </div>

            {submitError && (
              <Alert tone="error" title="Submission failed">
                {submitError} — your entered data is preserved.
              </Alert>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Duplicate protection: the button stays disabled while saving.
              </p>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!contextValid && (
        <p className="text-center text-sm text-slate-500">
          Fill in the match information above to continue.
        </p>
      )}

      {templates.isLoading && <LoadingState label="Loading templates…" />}
    </form>
  );
}
