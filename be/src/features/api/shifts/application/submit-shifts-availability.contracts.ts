import type { SaveShiftsAvailabilityParams } from "@modules/domain/shifts"

/** What file the caller's own availability statement, waiting for approval takes. */
export interface SubmitShiftsAvailabilityRequest extends SaveShiftsAvailabilityParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
