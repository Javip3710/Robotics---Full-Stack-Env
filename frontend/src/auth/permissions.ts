/**
 * Frontend permission mirrors for UI gating ONLY.
 * The backend enforces every rule server-side; these copies just decide what
 * to render. They must stay in sync with backend/permissions.py.
 */

import type { CurrentUser, Role } from "../api/types";

export type PermissionAction =
  | "approve_members"
  | "assign_roles"
  | "delete_members"
  | "publish_news"
  | "manage_events"
  | "manage_documents"
  | "view_scouting_results"
  | "manage_scouting_templates"
  | "edit_any_scouting_submission"
  | "view_member_directory";

const RULES: Record<PermissionAction, readonly Role[]> = {
  approve_members: ["mentor", "captain"],
  assign_roles: ["mentor", "captain"],
  delete_members: ["mentor"],
  publish_news: ["mentor", "captain", "lead"],
  manage_events: ["mentor", "captain"],
  manage_documents: ["mentor", "captain", "lead"],
  view_scouting_results: ["mentor", "captain", "lead", "member"],
  manage_scouting_templates: ["mentor", "captain"],
  edit_any_scouting_submission: ["mentor", "captain"],
  view_member_directory: ["mentor", "captain", "lead", "member"],
};

export function can(user: CurrentUser | null, action: PermissionAction): boolean {
  if (!user || user.status !== "approved") return false;
  return RULES[action].includes(user.role);
}

/** REQUIRED rule: inventory is for approved mentors and captains only. */
export function canAccessInventory(user: CurrentUser | null): boolean {
  return !!user && user.status === "approved" && (user.role === "mentor" || user.role === "captain");
}

export function isApproved(user: CurrentUser | null): boolean {
  return !!user && user.status === "approved";
}
