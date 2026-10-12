/** Pure member types and permission rules (no server imports): safe to use from client components. */

/** Workspace roles: owner and manager govern; staff operate. */
export type Role = "owner" | "manager" | "staff";

/** One person's identity inside one workspace. This (never a free-text name) is what authors and decides. */
export type Member = {
  userId: string;
  workspaceId: string;
  role: Role;
  /** The `staff` row this account is, when it is one (staff relay, assignments). */
  staffId: string | null;
  displayName: string;
  status: "active" | "disabled";
};

/** True for owner and manager. */
export const isManagerRole = (role: Role): boolean => role === "owner" || role === "manager";

/**
 * Whether `member` may decide a work item. Owner and manager decide anything; staff decide only items assigned to them
 * (`assignee_id` is the assigned staff id; an unassigned item is not theirs).
 */
export const canDecide = (member: Member, item: { assignee_kind?: string | null; assignee_id?: string | null }): boolean => {
  if (member.status !== "active") return false;
  if (isManagerRole(member.role)) return true;
  if (item.assignee_kind && item.assignee_kind !== "staff") return false;
  return !!member.staffId && item.assignee_id === member.staffId;
};
