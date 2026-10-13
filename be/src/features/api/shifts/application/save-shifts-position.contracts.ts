import type { SavePositionParams } from "@modules/domain/shifts"

/** What create or update one position takes. */
export interface SaveShiftsPositionRequest extends SavePositionParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
