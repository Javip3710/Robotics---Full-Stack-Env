import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { useInventoryItem, useInventoryMutations, useItemAdjustments } from "../api/hooks";
import { ApiError } from "../api/client";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Textarea,
  formatDateTime,
} from "../components/ui";

export default function InventoryItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const id = Number(itemId);
  const item = useInventoryItem(id);
  const history = useItemAdjustments(id);
  const { adjust, update } = useInventoryMutations();

  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustFieldErrors, setAdjustFieldErrors] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  if (item.isLoading) return <LoadingState />;
  if (item.isError) {
    return <ErrorState message={item.error.message} retry={() => item.refetch()} />;
  }
  const it = item.data!;

  async function onAdjust(e: FormEvent) {
    e.preventDefault();
    setAdjustError(null);
    setAdjustFieldErrors({});
    try {
      await adjust.mutateAsync({
        id,
        quantity_change: Number(adjustQty),
        reason: adjustReason,
      });
      setAdjustQty("");
      setAdjustReason("");
    } catch (err) {
      if (err instanceof ApiError) {
        setAdjustError(err.message);
        if (err.details) setAdjustFieldErrors(err.details);
      }
    }
  }

  async function saveNotes(e: FormEvent) {
    e.preventDefault();
    setNotesSaved(false);
    try {
      await update.mutateAsync({ id, body: { notes } });
      setNotesSaved(true);
    } catch {
      /* error surfaced via mutation state */
    }
  }

  async function toggleArchive() {
    setArchiveBusy(true);
    try {
      await update.mutateAsync({ id, body: { archived: !it.archived } });
    } finally {
      setArchiveBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/app/inventory" className="text-sm text-brand-700 hover:underline">
        ← Back to inventory
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{it.name}</h1>
            {it.archived && <Badge tone="gray">Archived</Badge>}
            {it.low_stock && <Badge tone="red">Low stock</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {it.category} · {it.part_number ?? "no part number"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-900">
            {it.quantity} <span className="text-base font-normal text-slate-500">{it.unit}</span>
          </p>
          {it.low_stock_threshold !== null && (
            <p className="text-xs text-slate-500">Low-stock threshold: {it.low_stock_threshold}</p>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stock adjustment */}
        <Card>
          <CardHeader title="Adjust stock" description="Every change is recorded with a reason, user, and timestamp." />
          <form onSubmit={onAdjust} className="space-y-4 p-4 sm:p-6" noValidate>
            {adjustError && (
              <Alert tone="error" title="Adjustment failed">
                {adjustError}
              </Alert>
            )}
            <Field
              label="Quantity change"
              htmlFor="adjust-qty"
              required
              help="Use negative numbers to remove stock."
              error={adjustFieldErrors.quantity_change}
            >
              <Input
                id="adjust-qty"
                type="number"
                step="any"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. -3"
                required
              />
            </Field>
            <Field label="Reason" htmlFor="adjust-reason" required error={adjustFieldErrors.reason}>
              <Input
                id="adjust-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Used on practice bot"
                required
              />
            </Field>
            <Button type="submit" disabled={adjust.isPending}>
              {adjust.isPending ? "Recording…" : "Record adjustment"}
            </Button>
          </form>
        </Card>

        {/* Details + notes */}
        <Card>
          <CardHeader title="Details" />
          <div className="space-y-4 p-4 sm:p-6">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Location</dt>
                <dd className="font-medium">{it.location || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium">{it.category}</dd>
              </div>
            </dl>
            <form onSubmit={saveNotes} className="space-y-3">
              <Field label="Notes" htmlFor="item-notes-edit">
                <Textarea
                  id="item-notes-edit"
                  value={notes || it.notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesSaved(false);
                  }}
                  rows={3}
                />
              </Field>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" variant="secondary" disabled={update.isPending}>
                  Save notes
                </Button>
                {notesSaved && <span className="text-xs font-medium text-green-700">Saved</span>}
              </div>
            </form>
            <div className="border-t border-slate-200 pt-4">
              <Button
                variant={it.archived ? "secondary" : "danger"}
                size="sm"
                onClick={toggleArchive}
                disabled={archiveBusy}
              >
                {it.archived ? "Restore item" : "Archive item"}
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                Archiving keeps the item and its full history instead of deleting it.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Adjustment history */}
      <Card>
        <CardHeader
          title="Adjustment history"
          description="Quantity changes are kept consistent with this history by the backend."
        />
        {history.isLoading && <LoadingState />}
        {history.data && history.data.items.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No adjustments recorded yet.</p>
        )}
        {history.data && history.data.items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {history.data.items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    <span className={a.quantity_change > 0 ? "text-green-700" : "text-red-700"}>
                      {a.quantity_change > 0 ? `+${a.quantity_change}` : a.quantity_change}
                    </span>{" "}
                    {it.unit} — {a.reason}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.user} · {formatDateTime(a.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
