import type { SaveSettingsParams } from "@modules/domain/hiring"

/** What change the hiring settings takes. */
export interface SaveHiringSettingsRequest extends SaveSettingsParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
