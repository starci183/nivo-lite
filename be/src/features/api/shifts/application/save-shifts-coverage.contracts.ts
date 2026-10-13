import type { SaveCoverageParams } from "@modules/domain/shifts"

/** What create or update one coverage block takes. */
export interface SaveShiftsCoverageRequest extends SaveCoverageParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
