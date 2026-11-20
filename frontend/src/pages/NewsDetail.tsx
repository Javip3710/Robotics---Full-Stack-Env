import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { newsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { Card, ErrorState, LoadingState, formatDate } from "../components/ui";

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["news", "detail", id],
    queryFn: () => newsApi.get(Number(id)),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={error.message} retry={() => refetch()} />;

  const post = data!.post;
  const mayEdit = can(user, "publish_news");
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-brand-700 hover:underline">
          ← Back to news
        </Link>
        {mayEdit && (
          <Link to={`/app/news/${post.id}/edit`} className="text-sm text-brand-700 hover:underline">
            Edit post
          </Link>
        )}
      </div>
      <Card className="mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{post.author ?? "Former member"}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time>
          {post.featured && (
            <span className="rounded bg-gold-100 px-2 py-0.5 font-medium text-brand-700">Featured</span>
          )}
          {!post.published && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 font-medium text-yellow-800">
              Draft — not public
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold">{post.title}</h1>
        <p className="mt-2 font-medium text-slate-600">{post.summary}</p>
        {/* Body is sanitized server-side (allowlisted tags/attributes only). */}
        <div className="rich-text mt-4" dangerouslySetInnerHTML={{ __html: post.body }} />
      </Card>
    </article>
  );
}
