import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** The roles that may change the catalogue, order goods and approve what the system drafted. */
export const MANAGER_ROLES: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** No role restriction: every active member of the workspace. */
export const ANY_MEMBER: ReadonlyArray<WorkspaceRole> = []
