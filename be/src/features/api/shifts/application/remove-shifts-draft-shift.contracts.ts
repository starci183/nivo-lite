import type { RemoveDraftShiftParams } from "@modules/domain/shifts"

/** What remove a shift from a draft schedule takes. */
export interface RemoveShiftsDraftShiftRequest extends RemoveDraftShiftParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
