import type { StatusSet } from "@modules/domain/platform-admin"
import type { SupportStatus } from "@modules/domain/workspaces"

/** What setWorkspaceStatus takes. */
export interface SetWorkspaceStatusRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The billing status to set. */
    readonly status: SupportStatus
}

/** What setWorkspaceStatus answers. */
export type SetWorkspaceStatusResult = Readonly<StatusSet>
