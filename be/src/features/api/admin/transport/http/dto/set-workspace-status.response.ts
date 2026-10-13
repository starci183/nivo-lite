import type { SupportStatus } from "@modules/domain/workspaces"

/** The HTTP response of setWorkspaceStatus. */
export class SetWorkspaceStatusResponse {
    /** The status now set. */
    status!: SupportStatus
}
