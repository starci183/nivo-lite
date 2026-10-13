import "server-only"

import { request } from "../client"
import type { Outcome } from "../outcome"
import { decodeAdminWorkspace } from "./admin.mapper"
import type { AdminWorkspaceDetail } from "./admin.mapper"
import type { AdminReadInput } from "./read-session"

/** Which workspace to read. */
export interface AdminWorkspaceInput extends AdminReadInput {
    readonly workspaceId: string
}

/** Reads the full read-only overview of one workspace. */
export const readAdminWorkspace = (input: AdminWorkspaceInput): Promise<Outcome<AdminWorkspaceDetail>> =>
    request(
        { path: `/admin/workspaces/${input.workspaceId}`, token: input.token, locale: input.locale },
        decodeAdminWorkspace,
    )
