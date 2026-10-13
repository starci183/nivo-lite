import type { ListWorkspacesRequest, ListWorkspacesResult } from "../../application/list-workspaces.contracts"
import type { AdminWorkspacesInput } from "./dto/admin-workspaces.input"
import type { AdminWorkspaceListType } from "./dto/admin-workspace-list.type"

/** Maps the GraphQL input to the application request. */
export const toAdminWorkspacesRequest = (input: AdminWorkspacesInput): ListWorkspacesRequest => ({
    filter: input.filter,
    query: input.query,
})

/** Maps the application result to the GraphQL type. */
export const toAdminWorkspaceListType = (result: ListWorkspacesResult): AdminWorkspaceListType => ({
    total: result.total,
    counts: { ...result.counts },
    items: result.items.map((item) => ({
        ...item,
        modules: item.modules.map((entry) => ({ ...entry })),
        connections: item.connections.map((entry) => ({ ...entry })),
    })),
})
