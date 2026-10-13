import type { ApplyImportParams } from "@modules/domain/shifts"

/** What read the quick import text and set the shop up from it takes. */
export interface ApplyShiftsImportRequest extends ApplyImportParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
