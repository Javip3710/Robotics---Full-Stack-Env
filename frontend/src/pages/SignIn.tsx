import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { Alert, Button, Card, Field, Input } from "../components/ui";

export default function SignIn() {
  const { signIn, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/app";

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        navigate(from, { replace: true });
      } else {
        const user = await register(name, email, password);
        setMode("signin");
        setNotice(
          `Account created for ${user.name}. Your membership is pending — sign in to check your status.`,
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) setFieldErrors(err.details);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card className="p-6 sm:p-8">
        <h1 className="text-xl font-bold">
          {mode === "signin" ? "Sign in to the team portal" : "Create an account"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {mode === "signin"
            ? "Use the account a mentor or captain set up for you."
            : "New accounts start as pending until a mentor or captain approves them."}
        </p>

        {notice && (
          <div className="mt-4">
            <Alert tone="success" title="Registration successful">
              {notice}
            </Alert>
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Alert tone="error" title="Could not continue">
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          {mode === "register" && (
            <Field label="Full name" htmlFor="name" required error={fieldErrors.name}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
          )}
          <Field label="Email" htmlFor="email" required error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            required
            error={fieldErrors.password}
            help={mode === "register" ? "At least 8 characters." : undefined}
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {mode === "signin" ? (
            <>
              Need an account?{" "}
              <button
                className="font-medium text-brand-700 underline"
                onClick={() => setMode("register")}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                className="font-medium text-brand-700 underline"
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </Card>

      <p className="mt-4 text-center text-xs text-slate-500">
        <Link to="/" className="underline">Back to home</Link>
      </p>
    </div>
  );
}
