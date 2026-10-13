import "server-only"

import { request } from "../client"
import type { Outcome } from "../outcome"
import { decodeAdminWorkspaces } from "./admin.mapper"
import type { AdminWorkspaceFilter, AdminWorkspaceList } from "./admin.mapper"
import type { AdminReadInput } from "./read-session"

/** The filter and the free-text search of the workspace list. */
export interface AdminWorkspacesInput extends AdminReadInput {
    readonly filter: AdminWorkspaceFilter
    readonly query: string
}

/** Reads every customer workspace the filter and the search keep, with the size of each filter. */
export const readAdminWorkspaces = (input: AdminWorkspacesInput): Promise<Outcome<AdminWorkspaceList>> =>
    request(
        {
            path: "/admin/workspaces",
            token: input.token,
            locale: input.locale,
            query: { filter: input.filter, query: input.query },
        },
        decodeAdminWorkspaces,
    )
