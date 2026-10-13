import type { AddDraftShiftParams } from "@modules/domain/shifts"

/** What add a shift to a draft schedule takes. */
export interface AddShiftsDraftShiftRequest extends AddDraftShiftParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
