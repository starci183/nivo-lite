import type { SetInterviewStatusParams } from "@modules/domain/hiring"

/** What mark an interview done, cancelled or missed takes. */
export interface SetHiringInterviewStatusRequest extends SetInterviewStatusParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
