import { useState } from "react";
import type { FormEvent } from "react";

import { useTemplateMutations, useTemplates } from "../api/hooks";
import { ApiError } from "../api/client";
import type { FieldDef, FieldType, Template, TemplateStatus } from "../api/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  Textarea,
  formatDate,
} from "../components/ui";

const FIELD_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "number",
  "checkbox",
  "single_select",
  "multi_select",
];

function emptyField(): Omit<FieldDef, "position"> {
  return {
    field_key: "",
    label: "",
    field_type: "short_text",
    required: false,
    help_text: "",
    options: [],
    min_value: null,
    max_value: null,
  };
}

export default function ScoutingTemplates() {
  const { data, isLoading, isError, error, refetch } = useTemplates(true);
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Scouting templates</h1>
          <p className="mt-1 text-slate-600">
            Editing fields creates a new immutable version. Existing submissions keep the version
            they were recorded with.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>New template</Button>
      </header>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={error.message} retry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <Card>
          <EmptyState title="No templates yet" description="Create the first scouting template." />
        </Card>
      )}

      <div className="grid gap-4">
        {data?.items.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{t.name}</h2>
                  <Badge
                    tone={t.status === "active" ? "green" : t.status === "draft" ? "yellow" : "gray"}
                  >
                    {t.status}
                  </Badge>
                  <Badge tone="gold">v{t.version}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{t.description || "No description."}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {t.season ? `Season ${t.season} · ` : ""}Updated {formatDate(t.updated_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>
                  Edit
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {t.fields?.map((f) => (
                <span key={f.field_key} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  {f.label} <span className="text-slate-400">({f.field_type})</span>
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TemplateEditor({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const { create, update } = useTemplateMutations();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [season, setSeason] = useState(template?.season ?? "");
  const [status, setStatus] = useState<TemplateStatus>(template?.status ?? "draft");
  const [fields, setFields] = useState<Omit<FieldDef, "position">[]>(
    template?.fields?.map((f) => ({ ...f })) ?? [emptyField()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateField(i: number, patch: Partial<Omit<FieldDef, "position">>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function move(i: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTopError(null);
    setErrors({});
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = "Name is required.";
    fields.forEach((f, i) => {
      if (!/^[a-z][a-z0-9_]*$/.test(f.field_key.trim()))
        errs[`fields[${i}].field_key`] = "Lowercase letters, digits, underscores; must start with a letter.";
      if (!f.label.trim()) errs[`fields[${i}].label`] = "Label is required.";
      if (f.field_type.endsWith("select") && f.options.filter((o) => o.trim()).length === 0)
        errs[`fields[${i}].options`] = "Select fields need at least one option.";
    });
    const keys = fields.map((f) => f.field_key.trim());
    if (new Set(keys).size !== keys.length) {
      errs["fields"] = "Field keys must be unique.";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setBusy(true);
    const body = {
      name: name.trim(),
      description: description.trim(),
      season: season.trim(),
      status,
      fields: fields.map((f) => ({
        ...f,
        field_key: f.field_key.trim(),
        label: f.label.trim(),
        options: f.field_type.endsWith("select")
          ? f.options.filter((o) => o.trim()).map((o) => o.trim())
          : [],
      })),
    };
    try {
      if (template) {
        await update.mutateAsync({ id: template.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setTopError(err.message);
        if (err.details) setErrors(err.details);
      } else {
        setTopError("Could not save the template.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={template ? `Edit: ${template.name}` : "New template"}
        description="Simple field list with add, edit, remove, and reorder controls. No drag-and-drop in this version."
        action={
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      />
      <form onSubmit={onSubmit} className="space-y-6 p-4 sm:p-6" noValidate>
        {topError && (
          <Alert tone="error" title="Could not save">
            {topError}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" htmlFor="tpl-name" required error={errors.name}>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Season / game" htmlFor="tpl-season" help="e.g. 2027">
            <Input id="tpl-season" value={season} onChange={(e) => setSeason(e.target.value)} />
          </Field>
          <Field label="Status" htmlFor="tpl-status">
            <Select id="tpl-status" value={status} onChange={(e) => setStatus(e.target.value as TemplateStatus)}>
              <option value="draft">Draft</option>
              <option value="active">Active (submittable)</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="tpl-desc">
            <Input id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        {errors["fields"] && <Alert tone="error">{errors["fields"]}</Alert>}

        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Fields (in order)
          </h3>
          {fields.map((f, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Field {i + 1}</span>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === fields.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                    disabled={fields.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Field key" htmlFor={`f-${i}-key`} required help="Stable ID used to key answers." error={errors[`fields[${i}].field_key`]}>
                  <Input
                    id={`f-${i}-key`}
                    value={f.field_key}
                    onChange={(e) => updateField(i, { field_key: e.target.value })}
                    placeholder="drivetrain"
                    className="font-mono text-sm"
                  />
                </Field>
                <Field label="Label" htmlFor={`f-${i}-label`} required error={errors[`fields[${i}].label`]}>
                  <Input id={`f-${i}-label`} value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
                </Field>
                <Field label="Type" htmlFor={`f-${i}-type`}>
                  <Select
                    id={`f-${i}-type`}
                    value={f.field_type}
                    onChange={(e) => updateField(i, { field_type: e.target.value as FieldType })}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace("_", " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Help text" htmlFor={`f-${i}-help`}>
                  <Input id={`f-${i}-help`} value={f.help_text} onChange={(e) => updateField(i, { help_text: e.target.value })} />
                </Field>
                {f.field_type === "number" && (
                  <>
                    <Field label="Min value" htmlFor={`f-${i}-min`}>
                      <Input
                        id={`f-${i}-min`}
                        type="number"
                        value={f.min_value ?? ""}
                        onChange={(e) =>
                          updateField(i, { min_value: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field label="Max value" htmlFor={`f-${i}-max`}>
                      <Input
                        id={`f-${i}-max`}
                        type="number"
                        value={f.max_value ?? ""}
                        onChange={(e) =>
                          updateField(i, { max_value: e.target.value === "" ? null : Number(e.target.value) })
                        }
                      />
                    </Field>
                  </>
                )}
                {f.field_type.endsWith("select") && (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Field
                      label="Options (one per line)"
                      htmlFor={`f-${i}-options`}
                      required
                      error={errors[`fields[${i}].options`]}
                    >
                      <Textarea
                        id={`f-${i}-options`}
                        value={f.options.join("\n")}
                        onChange={(e) => updateField(i, { options: e.target.value.split("\n") })}
                        rows={3}
                        className="text-sm"
                      />
                    </Field>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <Checkbox
                  id={`f-${i}-required`}
                  label="Required"
                  checked={f.required}
                  onChange={(e) => updateField(i, { required: e.target.checked })}
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setFields((prev) => [...prev, emptyField()])}>
            + Add field
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : template ? "Save changes" : "Create template"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
