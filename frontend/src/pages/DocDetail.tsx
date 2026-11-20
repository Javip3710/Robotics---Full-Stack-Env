import { Link, useParams } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import { docsApi } from "../api/endpoints";
import { useLocation } from "react-router-dom";
import { Badge, Card, ErrorState, LoadingState, formatDate } from "../components/ui";

export default function DocDetail({ internal = false }: { internal?: boolean }) {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["docs", "detail", slug],
    queryFn: () => docsApi.get(slug!),
  });

  const base = internal ? "/app/docs" : "/docs";

  if (isLoading) return <LoadingState />;
  if (isError) {
    return (
      <div className="space-y-4">
        <Link to={base} className="text-sm text-brand-700 hover:underline">
          ← Back to documentation
        </Link>
        <ErrorState message={error.message} retry={() => refetch()} />
      </div>
    );
  }

  const doc = data!;
  return (
    <article className="mx-auto max-w-3xl">
      <Link to={base} className="text-sm text-brand-700 hover:underline">
        ← Back to documentation
      </Link>
      <Card className="mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{doc.category}</span>
          <span aria-hidden>·</span>
          <span>Updated {formatDate(doc.updated_at)}</span>
          {doc.visibility === "internal" && <Badge tone="blue">Internal</Badge>}
        </div>
        <h1 className="mt-2 text-2xl font-bold">{doc.title}</h1>
        <div className="mt-4 whitespace-pre-line leading-relaxed text-slate-800">{doc.body}</div>
      </Card>
      {location.pathname.startsWith("/app") ? null : (
        <p className="mt-4 text-xs text-slate-500">
          Note: document content is plain text — HTML is never executed.
        </p>
      )}
    </article>
  );
}
