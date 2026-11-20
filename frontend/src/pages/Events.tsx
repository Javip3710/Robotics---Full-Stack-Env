import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "../api/client";
import { useEventMutations, useEvents } from "../api/hooks";
import type { TeamEvent } from "../api/types";
import { Alert, Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, Textarea } from "../components/ui";

const blank = { name: "", date: "", location: "", description: "" };

export default function Events() {
  const events = useEvents(false);
  const { create, update, remove } = useEventMutations();
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(blank);
  const [deleting, setDeleting] = useState<TeamEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);
  const busyRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const busy = create.isPending || update.isPending || remove.isPending;

  function reset() {
    setEditing(null);
    setForm(blank);
    setDetails({});
    setError(null);
  }

  function edit(event: TeamEvent) {
    setEditing(event.id);
    setForm({ name: event.name, date: event.date, location: event.location, description: event.description });
    setDetails({});
    setError(null);
    setSuccess(null);
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = "Name must contain at least 3 characters.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) next.date = "A valid date is required.";
    setDetails(next);
    if (Object.keys(next).length) return;
    busyRef.current = true;
    setError(null);
    setSuccess(null);
    try {
      if (editing !== null) await update.mutateAsync({ id: editing, body: form });
      else await create.mutateAsync(form);
      setSuccess(editing !== null ? "Event updated." : "Event created.");
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event.");
      if (err instanceof ApiError) setDetails(err.details ?? {});
    } finally {
      busyRef.current = false;
    }
  }

  async function confirmDelete() {
    if (!deleting || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setSuccess(null);
    try {
      await remove.mutateAsync(deleting.id);
      if (editing === deleting.id) reset();
      setDeleting(null);
      setSuccess("Event deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete event.");
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="mt-1 text-slate-600">Manage upcoming and past events. Saved events are public; upcoming events appear on the home page.</p>
      </header>
      {error && <Alert tone="error" title="Action failed">{error}</Alert>}
      {success && <p role="status" className="text-sm font-medium text-green-800">{success}</p>}
      <Card className="p-6">
        <h2 className="mb-4 font-semibold">{editing !== null ? "Edit event" : "Add event"}</h2>
        <form onSubmit={save} className="space-y-4">
          <Field label="Event name" htmlFor="event-name" required error={details.name}>
            <input ref={titleRef} id="event-name" required minLength={3} maxLength={200} value={form.name}
              disabled={busy} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-brand-600" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="event-date" required error={details.date}>
              <Input id="event-date" type="date" required value={form.date} disabled={busy}
                onChange={e => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Location" htmlFor="event-location" error={details.location}>
              <Input id="event-location" maxLength={200} value={form.location} disabled={busy}
                onChange={e => setForm({ ...form, location: e.target.value })} />
            </Field>
          </div>
          <Field label="Description" htmlFor="event-description" error={details.description}>
            <Textarea id="event-description" maxLength={10000} value={form.description} disabled={busy}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>{create.isPending || update.isPending ? "Saving…" : editing !== null ? "Save changes" : "Add event"}</Button>
            {editing !== null && <Button type="button" variant="secondary" disabled={busy} onClick={reset}>Cancel editing</Button>}
          </div>
        </form>
      </Card>
      {deleting && (
        <Card className="space-y-3 border-red-200 p-5">
          <h2 className="font-semibold">Delete “{deleting.name}”?</h2>
          <p className="text-sm text-slate-600">This permanently removes the event from listings. Existing scouting submissions will not be deleted.</p>
          <div className="flex gap-3">
            <Button variant="danger" disabled={busy} onClick={() => void confirmDelete()}>{remove.isPending ? "Deleting…" : "Confirm delete"}</Button>
            <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel deletion</Button>
          </div>
        </Card>
      )}
      <section aria-label="All events" className="space-y-3">
        <h2 className="font-semibold">All events</h2>
        {events.isLoading && <LoadingState />}
        {events.isError && <ErrorState message={events.error.message} retry={() => events.refetch()} />}
        {events.data?.items.length === 0 && <EmptyState title="No events yet" description="Add your first event using the form." />}
        {events.data?.items.map(event => (
          <Card key={event.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 break-words">
              <h3 className="font-semibold">{event.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{event.date}{event.location ? ` · ${event.location}` : ""}</p>
              {event.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{event.description}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" disabled={busy} aria-label={`Edit ${event.name}`} onClick={() => edit(event)}>Edit</Button>
              <Button variant="danger" size="sm" disabled={busy} aria-label={`Delete ${event.name}`} onClick={() => { setDeleting(event); setError(null); setSuccess(null); }}>Delete</Button>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
