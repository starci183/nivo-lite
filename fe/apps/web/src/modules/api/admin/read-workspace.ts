import "server-only"

import { decoded } from "../decode"
import type { Outcome } from "../outcome"
import { apiRequest } from "../request"
import { decodeAdminWorkspace } from "./admin.mapper"
import type { AdminWorkspaceDetail } from "./admin.mapper"

/** Reads the full read-only overview of one workspace. */
export const readAdminWorkspace = async (workspaceId: string): Promise<Outcome<AdminWorkspaceDetail>> =>
    decoded(await apiRequest<unknown>(`/admin/workspaces/${encodeURIComponent(workspaceId)}`), decodeAdminWorkspace)
