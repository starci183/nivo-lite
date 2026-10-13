import type { SetJobStatusParams } from "@modules/domain/hiring"

/** What open, pause or close a job takes. */
export interface SetHiringJobStatusRequest extends SetJobStatusParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
