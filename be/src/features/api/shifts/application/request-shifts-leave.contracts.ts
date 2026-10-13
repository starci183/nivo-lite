import type { RequestLeaveParams } from "@modules/domain/shifts"

/** What ask for leave takes. */
export interface RequestShiftsLeaveRequest extends RequestLeaveParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
