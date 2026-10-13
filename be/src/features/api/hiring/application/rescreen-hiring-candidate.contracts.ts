import type { RescreenParams } from "@modules/domain/hiring"

/** What screen a candidate again takes. */
export interface RescreenHiringCandidateRequest extends RescreenParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
