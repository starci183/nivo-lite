import type { SaveShiftsAvailabilityParams } from "@modules/domain/shifts"

/** What add an availability statement for a person, approved at once takes. */
export interface AddShiftsAvailabilityRequest extends SaveShiftsAvailabilityParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
