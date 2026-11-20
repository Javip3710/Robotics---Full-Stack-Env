import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { useInventoryCategories, useInventoryItems, useInventoryMutations } from "../api/hooks";
import { ApiError } from "../api/client";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  TableWrap,
  Td,
  Textarea,
  Th,
} from "../components/ui";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, isError, error, refetch } = useInventoryItems({
    search: search || undefined,
    category: category || undefined,
    includeArchived,
  });
  const categories = useInventoryCategories();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="mt-1 text-slate-600">
            Manage Inventory of the team; Tools or bolts.
          </p>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Close" : "Add item"}
        </Button>
      </header>

      {showAdd && <AddItemForm onDone={() => setShowAdd(false)} />}

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            type="search"
            placeholder="Search name, part number, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inventory"
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.data?.items.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-brand-600"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Include archived
          </label>
        </div>
      </Card>

      <Card>
        {isLoading && <LoadingState />}
        {isError && <ErrorState message={error.message} retry={() => refetch()} />}
        {data && data.items.length === 0 && (
          <EmptyState title="No items found" description="Try clearing the search or filters." />
        )}
        {data && data.items.length > 0 && (
          <TableWrap>
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Category</Th>
                <Th>Quantity</Th>
                <Th>Location</Th>
                <Th className="sr-only">Open</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <Td>
                    <div>
                      <p className="font-medium text-slate-900">
                        {item.name}
                        {item.archived && (
                          <Badge tone="gray">
                            <span className="ml-1">archived</span>
                          </Badge>
                        )}
                      </p>
                      {item.part_number && (
                        <p className="text-xs text-slate-500">{item.part_number}</p>
                      )}
                    </div>
                  </Td>
                  <Td className="text-slate-600">{item.category}</Td>
                  <Td>
                    <span className={item.low_stock ? "font-semibold text-red-600" : "text-slate-900"}>
                      {item.quantity} {item.unit}
                    </span>
                    {item.low_stock && (
                      <p className="text-xs font-medium text-red-600">Low stock</p>
                    )}
                  </Td>
                  <Td className="text-slate-600">{item.location || "—"}</Td>
                  <Td>
                    <Link
                      to={`/app/inventory/${item.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      Manage
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

function AddItemForm({ onDone }: { onDone: () => void }) {
  const { create } = useInventoryMutations();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("each");
  const [location, setLocation] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [threshold, setThreshold] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setTopError(null);
    try {
      await create.mutateAsync({
        name,
        category,
        quantity: Number(quantity),
        unit,
        location,
        part_number: partNumber || null,
        notes,
        low_stock_threshold: threshold === "" ? null : Number(threshold),
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setTopError(err.message);
        if (err.details) setErrors(err.details);
      }
    }
  }

  return (
    <Card>
      <CardHeader title="Add inventory item" />
      <form onSubmit={onSubmit} className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6" noValidate>
        {topError && (
          <div className="sm:col-span-2">
            <Alert tone="error" title="Could not add item">
              {topError}
            </Alert>
          </div>
        )}
        <Field label="Name" htmlFor="item-name" required error={errors.name}>
          <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Category" htmlFor="item-category">
          <Input id="item-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label="Quantity" htmlFor="item-qty" required error={errors.quantity}>
          <Input id="item-qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </Field>
        <Field label="Unit" htmlFor="item-unit" help="e.g. each, feet, meters">
          <Input id="item-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Storage location" htmlFor="item-loc">
          <Input id="item-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Part number (optional)" htmlFor="item-part">
          <Input id="item-part" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
        </Field>
        <Field label="Low-stock threshold (optional)" htmlFor="item-threshold" help="Flag as low stock at or below this quantity.">
          <Input id="item-threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes (optional)" htmlFor="item-notes">
            <Textarea id="item-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Adding…" : "Add item"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
