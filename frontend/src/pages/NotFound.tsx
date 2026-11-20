import { Link } from "react-router-dom";

import { Card } from "../components/ui";

export default function NotFound() {
  return (
    <Card className="mx-auto mt-16 max-w-md p-10 text-center">
      <h1 className="text-4xl font-bold text-slate-300">404</h1>
      <p className="mt-2 font-medium">Page not found</p>
      <p className="mt-1 text-sm text-slate-600">The page you are looking for does not exist.</p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Back to home
      </Link>
    </Card>
  );
}
