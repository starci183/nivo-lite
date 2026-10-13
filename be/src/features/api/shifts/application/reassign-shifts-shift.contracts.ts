import type { ReassignShiftParams } from "@modules/domain/shifts"

/** What give a draft shift to another person or open it takes. */
export interface ReassignShiftsShiftRequest extends ReassignShiftParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
