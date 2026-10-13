import type { RemoveAvailabilityParams } from "@modules/domain/shifts"

/** What remove an availability statement takes. */
export interface RemoveShiftsAvailabilityRequest extends RemoveAvailabilityParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
