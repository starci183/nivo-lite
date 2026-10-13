import "server-only"

import { decoded } from "../decode"
import type { Outcome } from "../outcome"
import { apiRequest } from "../request"
import { decodeAdminWorkspaces } from "./admin.mapper"
import type { AdminWorkspaceFilter, AdminWorkspaceList } from "./admin.mapper"

/** The filter and the free-text search of the workspace list. */
export interface AdminWorkspacesInput {
    readonly filter: AdminWorkspaceFilter
    readonly query: string
}

/** Reads every customer workspace the filter and the search keep, with the size of each filter. */
export const readAdminWorkspaces = async (input: AdminWorkspacesInput): Promise<Outcome<AdminWorkspaceList>> =>
    decoded(
        await apiRequest<unknown>(
            `/admin/workspaces?${new URLSearchParams({ filter: input.filter, query: input.query }).toString()}`,
        ),
        decodeAdminWorkspaces,
    )
