import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { useMemberMutations, useMembers } from "../api/hooks";
import { ApiError } from "../api/client";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  RoleBadge,
  Select,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  formatDate,
} from "../components/ui";

const ROLES = ["mentor", "captain", "lead", "member"];

export default function Members() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";
  const roleFilter = searchParams.get("role") ?? "";

  const { data, isLoading, isError, error, refetch } = useMembers(statusFilter, roleFilter);
  const { setRole, approve, suspend, remove } = useMemberMutations();
  const [actionError, setActionError] = useState<string | null>(null);

  const canApprove = can(user, "approve_members");
  const canAssign = can(user, "assign_roles");
  const canDelete = can(user, "delete_members");

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="mt-1 text-slate-600">
          Team roster, roles, and membership status. Emails are visible only to member managers.
        </p>
      </header>

      {actionError && <Alert tone="error" title="Action failed">{actionError}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setFilter("status", e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
        <div className="sm:w-48">
          <Select
            value={roleFilter}
            onChange={(e) => setFilter("role", e.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        {isLoading && <LoadingState />}
        {isError && <ErrorState message={error.message} retry={() => refetch()} />}
        {data && data.items.length === 0 && (
          <EmptyState title="No members match" description="Try clearing the filters." />
        )}
        {data && data.items.length > 0 && (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                {(canApprove || canDelete) && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((member) => (
                <tr key={member.id} className={member.status === "pending" ? "bg-yellow-50/50" : undefined}>
                  <Td>
                    <div>
                      <p className="font-medium text-slate-900">{member.name}</p>
                      {canApprove && member.email && (
                        <p className="text-xs text-slate-500">{member.email}</p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {canAssign && member.id !== user?.id ? (
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          runAction(() => setRole.mutateAsync({ id: member.id, role: e.target.value }))
                        }
                        aria-label={`Role for ${member.name}`}
                        className="!w-32 !py-1 text-sm"
                        disabled={setRole.isPending}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={member.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-slate-600">{formatDate(member.created_at)}</Td>
                  {(canApprove || canDelete) && (
                    <Td>
                      <div className="flex gap-2">
                        {canApprove && member.status !== "approved" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={member.id === user?.id || approve.isPending}
                            onClick={() => runAction(() => approve.mutateAsync(member.id))}
                          >
                            Approve
                          </Button>
                        )}
                        {canApprove && member.status === "approved" && member.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={suspend.isPending}
                            onClick={() => runAction(() => suspend.mutateAsync(member.id))}
                          >
                            Suspend
                          </Button>
                        )}
                        {canDelete && member.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Permanently delete ${member.name}? Their news posts, scouting submissions, and inventory history are kept but unlinked from them.`,
                                )
                              ) {
                                runAction(() => remove.mutateAsync(member.id));
                              }
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {canApprove && (
        <Alert tone="info" title="Remember - You can't change your own role!">
        
        </Alert>
      )}
    </div>
  );
}
