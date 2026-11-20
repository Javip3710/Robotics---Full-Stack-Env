/**
 * Create / edit a news post. Available to anyone who can publish news
 * (mentors, captains, leads). Rich text body with image uploads; the
 * backend sanitizes everything again before storing.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { useNewsMutations } from "../api/hooks";
import { newsApi } from "../api/endpoints";
import { ApiError } from "../api/client";
import RichTextEditor from "../components/RichTextEditor";
import { Alert, Button, Card, ErrorState, Field, Input, LoadingState } from "../components/ui";

export default function NewsEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { create, update } = useNewsMutations();

  const existing = useQuery({
    queryKey: ["news", "detail", id],
    queryFn: () => newsApi.get(Number(id)),
    enabled: isEdit,
  });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [featured, setFeatured] = useState(false);
  const [published, setPublished] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load the existing post once (drafts stay in local state afterwards).
  useEffect(() => {
    if (isEdit && existing.data && !loaded) {
      const post = existing.data.post;
      setTitle(post.title);
      setSummary(post.summary);
      setBody(post.body);
      setFeatured(post.featured);
      setPublished(post.published);
      setLoaded(true);
    }
  }, [isEdit, existing.data, loaded]);

  if (isEdit && existing.isLoading) return <LoadingState />;
  if (isEdit && existing.isError) {
    return <ErrorState message={existing.error.message} retry={() => existing.refetch()} />;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = "Title is required.";
    if (summary.trim().length < 3) next.summary = "Summary is required.";
    if (body.replace(/<[^>]*>/g, "").trim().length < 3) next.body = "Body is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function save(publish: boolean) {
    setTopError(null);
    if (!validate()) return;
    setSaving(true);
    const payload = { title: title.trim(), summary: summary.trim(), body, published: publish, featured };
    try {
      const post = isEdit
        ? (await update.mutateAsync({ id: Number(id), body: payload })).post
        : (await create.mutateAsync(payload)).post;
      navigate(`/news/${post.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details);
      setTopError(err instanceof ApiError ? err.message : "Could not save the post.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? "Edit news post" : "New news post"}</h1>
        <Link to={isEdit ? `/news/${id}` : "/app"} className="text-sm text-brand-700 hover:underline">
          Cancel
        </Link>
      </div>

      {topError && (
        <Alert tone="error" title="Could not save">
          {topError}
        </Alert>
      )}

      <Card className="space-y-5 p-6">
        <Field label="Title" htmlFor="news-title" required error={errors.title}>
          <Input
            id="news-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            maxLength={200}
          />
        </Field>

        <Field
          label="Summary"
          htmlFor="news-summary"
          required
          error={errors.summary}
          help="One or two sentences shown in listings. Plain text."
        >
          <Input
            id="news-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Short summary"
            maxLength={500}
          />
        </Field>

        <Field label="Body" required error={errors.body} help="Format text, add links, and upload images with the toolbar.">
          <RichTextEditor
            value={body}
            onChange={setBody}
            placeholder="Write the post — select text to style it, or use the image button to upload a picture."
          />
        </Field>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-gold-500"
            />
            Featured (shown on the home page)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-gold-500"
            />
            Published (visible to the public)
          </label>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <Button onClick={() => void save(published)} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save"}
          </Button>
          {!published && (
            <Button variant="secondary" onClick={() => void save(true)} disabled={saving}>
              Publish now
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
