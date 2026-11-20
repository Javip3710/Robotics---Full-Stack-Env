import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { useDocCategories, useDocMutations, useDocs } from "../api/hooks";
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
  Textarea,
  formatDate,
} from "../components/ui";

export default function DocsIndex({ internal = false }: { internal?: boolean }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  const { data, isLoading, isError, error, refetch } = useDocs(search, category);
  const categories = useDocCategories();
  const { create } = useDocMutations();

  const canManage = internal && can(user, "manage_documents");
  const isInternalView = internal;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Documentation</h1>
          <p className="mt-1 text-slate-600">
            {isInternalView
              ? "Team documentation, including internal documents."
              : "Public team documentation."}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowEditor((v) => !v)}>
            {showEditor ? "Close editor" : "New document"}
          </Button>
        )}
      </header>

      {canManage && showEditor && <NewDocForm onSubmit={async (body) => {
        await create.mutateAsync(body);
        setShowEditor(false);
      }} busy={create.isPending} error={create.error} />}

      {/* Search + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search documents"
          />
        </div>
        <div className="sm:w-56">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.data?.items.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={error.message} retry={() => refetch()} />}
      {data && data.items.length === 0 && (
        <Card>
          <EmptyState title="No documents found" description="Try a different search or category." />
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.items.map((doc) => (
          <Card key={doc.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">
                <Link
                  to={`${isInternalView ? "/app/docs" : "/docs"}/${doc.slug}`}
                  className="hover:text-brand-700"
                >
                  {doc.title}
                </Link>
              </h2>
              {doc.visibility === "internal" && <Badge tone="blue">Internal</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {doc.category} · Updated {formatDate(doc.updated_at)}
            </p>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">
              {doc.body.slice(0, 160)}
              {doc.body.length > 160 ? "…" : ""}
            </p>
          </Card>
        ))}
      </div>


      {/* this option was removed, this is just the alert box for the bottom of the page. */}
      {/* {isInternalView && (
        <Alert tone="info">
          Internal documents are only visible to signed-in approved members. The backend enforces
          this — they never appear in public listings.
        </Alert>
      )} */}
    </div>
  );
}

function NewDocForm({
  onSubmit,
  busy,
  error,
}: {
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  error: unknown;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [visibility, setVisibility] = useState("public");
  const [body, setBody] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    try {
      await onSubmit({ title, category, visibility, body });
      setTitle("");
      setBody("");
    } catch (err) {
      if (err instanceof ApiError && err.details) setFieldErrors(err.details);
    }
  }

  return (
    <Card>
      <CardHeader title="New document" description="Write your documentation for it." />
      <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
        {error instanceof Error && (
          <Alert tone="error" title="Could not create document">
            {error.message}
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Title" htmlFor="doc-title" required error={fieldErrors.title}>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Category" htmlFor="doc-category">
            <Input id="doc-category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label="Visibility" htmlFor="doc-visibility">
            <Select
              id="doc-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="internal">Internal (approved members)</option>
            </Select>
          </Field>
        </div>
        <Field label="Body" htmlFor="doc-body" required error={fieldErrors.body}>
          <Textarea id="doc-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} required />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Create document"}
        </Button>
      </form>
    </Card>
  );
}
