import { Link } from "react-router-dom";

import { useEvents, useFeaturedNews, useNews } from "../api/hooks";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  formatDate,
} from "../components/ui";

export default function Home() {
  const news = useNews();
  const featured = useFeaturedNews();
  const events = useEvents(true);

  return (
    <div className="space-y-10">
      {/* Hero / team introduction */}
      <section className="rounded-2xl bg-slate-900 px-6 py-12 text-white sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold-400">
          Robo-Nerds · FRC Team 5089
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          The NerdWeb
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          We can discuss what to add here - as well as the background of it
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/about"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            About the team
          </Link>
          <Link
            to="/docs"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Documentation
          </Link>
          <Link
            to="/signin"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Featured announcement */}
      {featured.isLoading ? null : featured.data?.post ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Featured announcement</h2>
          <Card className="border-l-4 !border-l-gold-500 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded bg-gold-100 px-2 py-0.5 font-medium text-brand-700">
                Featured
              </span>
              <span>
                {featured.data.post.author} · {formatDate(featured.data.post.published_at)}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-semibold">
              <Link to={`/news/${featured.data.post.id}`} className="hover:text-brand-700">
                {featured.data.post.title}
              </Link>
            </h3>
            <p className="mt-1 text-slate-600">{featured.data.post.summary}</p>
          </Card>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Weekly news */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-xl font-semibold">Latest news</h2>
          {news.isLoading && <LoadingState label="Loading news…" />}
          {news.isError && <ErrorState message={news.error.message} retry={() => news.refetch()} />}
          {news.data && news.data.items.length === 0 && (
            <Card>
              <EmptyState title="No news yet" description="Published team updates will appear here." />
            </Card>
          )}
          <div className="space-y-4">
            {news.data?.items.map((post) => (
              <Card key={post.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{post.author}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={post.published_at ?? undefined}>
                    {formatDate(post.published_at)}
                  </time>
                </div>
                <h3 className="mt-1.5 font-semibold">
                  <Link to={`/news/${post.id}`} className="hover:text-brand-700">
                    {post.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm text-slate-600">{post.summary}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Upcoming events */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Upcoming events</h2>
          {events.isLoading && <LoadingState />}
          {events.isError && <ErrorState message={events.error.message} retry={() => events.refetch()} />}
          <div className="space-y-3">
            {events.data?.items.map((event) => (
              <Card key={event.id} className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {formatDate(event.date)}
                </p>
                <h3 className="mt-1 font-semibold text-slate-900">{event.name}</h3>
                {event.location && <p className="text-sm text-slate-500">{event.location}</p>}
                {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}
              </Card>
            ))}
            {events.data && events.data.items.length === 0 && (
              <Card>
                <EmptyState title="No upcoming events" />
              </Card>
            )}
          </div>
        </section>
      </div>

      {/* <Alert tone="info">
        All content on this site is placeholder data — nothing here represents a real team.
      </Alert> */}
    </div>
  );
}
