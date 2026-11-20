import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";
import { can, canAccessInventory, type PermissionAction } from "./permissions";
import { Alert, Card, Spinner } from "../components/ui";
import { TeamLogo } from "../components/TeamLogo";

/** Requires any signed-in user (pending/suspended allowed — they see the portal
 * shell with a status notice and forbidden states on protected content). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

/** Requires an approved member. */
export function RequireApproved({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" replace />;
  if (user.status !== "approved") {
    return (
      <Card className="mx-auto max-w-xl">
        <Alert
          tone={user.status === "pending" ? "info" : "error"}
          title={user.status === "pending" ? "Membership pending approval" : "Membership suspended"}
        >
          {user.status === "pending"
            ? "Your account is waiting for a mentor or captain to approve it. You will get full access once approved."
            : "Your membership has been suspended. Contact a mentor or captain."}
        </Alert>
      </Card>
    );
  }
  return <>{children}</>;
}

/** Requires a specific permission (frontend gating only; backend enforces too). */
export function RequirePermission({
  action,
  children,
}: {
  action: PermissionAction | "inventory";
  children: ReactNode;
}) {
  const { user } = useAuth();
  const allowed = action === "inventory" ? canAccessInventory(user) : can(user, action);
  if (!allowed) return <ForbiddenState />;
  return <>{children}</>;
}

export function ForbiddenState() {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <div className="flex flex-col items-center gap-4 py-8">
        <TeamLogo className="h-12 w-12 opacity-40" />
        <div>
          <h2 className="text-lg font-semibold">Access denied</h2>
          <p className="mt-1 text-sm text-slate-600">
            You do not have permission to view this page. If you believe this is a mistake,
            contact a mentor or captain.
          </p>
        </div>
      </div>
    </Card>
  );
}
