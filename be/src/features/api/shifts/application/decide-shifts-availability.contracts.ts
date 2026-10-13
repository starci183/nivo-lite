import type { DecideAvailabilityParams } from "@modules/domain/shifts"

/** What approve or decline a pending availability statement takes. */
export interface DecideShiftsAvailabilityRequest extends DecideAvailabilityParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
