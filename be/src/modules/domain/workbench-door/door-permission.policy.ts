import { isManagerRole, type WorkspaceRole } from "@modules/domain/workspace-members"

/**
 * Whether a member may run an action. The door is role-only: every member views every read; an owner or a manager runs every action;
 * a staff member runs an action only when its module declared the staff mark on it (`staff: true`, absent by default).
 */
export const mayRunAction = (role: WorkspaceRole, staffMarked: boolean): boolean => isManagerRole(role) || staffMarked
