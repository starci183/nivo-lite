import type { RemovePositionParams } from "@modules/domain/shifts"

/** What retire a position takes. */
export interface RemoveShiftsPositionRequest extends RemovePositionParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
