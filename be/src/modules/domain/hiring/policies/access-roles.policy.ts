import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** The roles that may set up hiring, build and publish schedules and decide requests. */
export const MANAGER_ROLES: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** No role restriction: every active member of the workspace. */
export const ANY_MEMBER: ReadonlyArray<WorkspaceRole> = []
