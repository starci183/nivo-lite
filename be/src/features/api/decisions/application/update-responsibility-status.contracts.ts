import type { ResponsibilityStatus } from "@modules/domain/responsibilities"

/** What moving a responsibility takes. */
export interface UpdateResponsibilityStatusRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The responsibility. */
    readonly responsibilityId: string
    /** The status to move it to. */
    readonly status: ResponsibilityStatus
}
