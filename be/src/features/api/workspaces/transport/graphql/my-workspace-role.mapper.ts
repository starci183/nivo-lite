import type { MyWorkspaceRoleRequest } from "../../application/my-workspace-role.contracts"

/** Maps the workspace of the request to the role query. */
export const toMyWorkspaceRoleRequest = (workspaceId: string): MyWorkspaceRoleRequest => ({ workspaceId })
