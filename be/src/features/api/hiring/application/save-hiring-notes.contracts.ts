import type { SaveNotesParams } from "@modules/domain/hiring"

/** What save the notes about a candidate takes. */
export interface SaveHiringNotesRequest extends SaveNotesParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
