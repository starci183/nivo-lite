import { WorkspaceEntity } from "./workspace.entity"

export { WorkspaceEntity } from "./workspace.entity"
export type { WorkspaceState } from "./workspace.entity"

/** Every entity of the workspaces capability. */
export const workspacesEntities: readonly [typeof WorkspaceEntity] = [WorkspaceEntity] as const
