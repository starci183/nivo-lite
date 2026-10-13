import type { SaveStaffParams } from "@modules/domain/shifts"

/** What create or update one person's shifts profile takes. */
export interface SaveShiftsStaffRequest extends SaveStaffParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
