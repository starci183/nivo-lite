import type { SaveShiftsSettingsParams } from "@modules/domain/shifts"

/** What save the notice, reminder and overtime rules takes. */
export interface SaveShiftsSettingsRequest extends SaveShiftsSettingsParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
