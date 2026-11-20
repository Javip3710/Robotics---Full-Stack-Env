/** Reusable UI primitives (shadcn-style, Tailwind-styled). */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// --- Button ------------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = {
    sm: "px-2.5 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

// --- Form controls -------------------------------------------------------------

export function Label({ htmlFor, children, required }: { htmlFor?: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
      {children}
      {required && <span className="ml-1 text-red-600" aria-hidden>*</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-gold-500 focus:outline-none disabled:bg-slate-100";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-[100px]", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, className)} {...props}>
      {children}
    </select>
  );
}

/** Field wrapper: label + control + help text + error, with accessible wiring. */
export function Field({
  label,
  htmlFor,
  help,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {help && !error && <p className="text-xs text-slate-500">{help}</p>}
      {error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id={id}
        className="h-6 w-6 rounded border-slate-300 text-brand-600 focus:ring-gold-500"
        {...props}
      />
      <label htmlFor={id} className="text-base font-medium text-slate-800">
        {label}
      </label>
    </div>
  );
}

// --- Surfaces -----------------------------------------------------------------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, description }: { title: ReactNode; action?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 sm:px-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// --- Badges --------------------------------------------------------------------

type Tone = "gray" | "green" | "red" | "yellow" | "blue" | "gold";

const toneClasses: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  yellow: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-100 text-blue-800",
  gold: "bg-gold-100 text-brand-700",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const tone: Tone =
    role === "mentor" ? "gold" : role === "captain" ? "blue" : role === "lead" ? "yellow" : "gray";
  return <Badge tone={tone}>{role}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "approved" ? "green" : status === "pending" ? "yellow" : "red";
  return <Badge tone={tone}>{status}</Badge>;
}

// --- Alerts --------------------------------------------------------------------

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "error" | "warning";
  title?: ReactNode;
  children?: ReactNode;
}) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-green-200 bg-green-50 text-green-900",
    error: "border-red-200 bg-red-50 text-red-900",
    warning: "border-yellow-200 bg-yellow-50 text-yellow-900",
  };
  return (
    <div className={cn("rounded-lg border p-4 text-sm", styles[tone])} role={tone === "error" ? "alert" : "status"}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

// --- States ---------------------------------------------------------------------

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={cn("animate-spin text-slate-400", className)} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-md text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, retry }: { message?: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Alert tone="error" title="Something went wrong">
        {message || "An unexpected error occurred."}
      </Alert>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// --- Table -----------------------------------------------------------------------

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-slate-100 px-4 py-2.5 align-middle", className)}>{children}</td>;
}

/** Friendly date formatting. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
