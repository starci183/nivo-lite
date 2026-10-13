import type { RemoveCoverageParams } from "@modules/domain/shifts"

/** What remove a coverage block takes. */
export interface RemoveShiftsCoverageRequest extends RemoveCoverageParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
