import type { GenerateAdParams } from "@modules/domain/hiring"

/** What draft the copy-ready ads of a job takes. */
export interface GenerateHiringAdRequest extends GenerateAdParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
