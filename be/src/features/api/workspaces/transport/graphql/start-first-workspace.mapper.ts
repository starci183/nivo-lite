import type { FirstWorkspace } from "@modules/domain/workspaces"
import type { StartFirstWorkspaceType } from "./dto/start-first-workspace.type"

/** Maps the first workspace (or none) to the GraphQL type. */
export const toStartFirstWorkspaceType = (result: FirstWorkspace): StartFirstWorkspaceType => ({
    id: result.id,
})
