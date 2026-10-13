import type { ApplyImportParams } from "@modules/domain/shifts"

/** What previewing the quick import text takes. */
export interface PreviewShiftsImportRequest extends ApplyImportParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
