import type { SaveJobParams } from "@modules/domain/hiring"

/** What create or update one job post takes. */
export interface SaveHiringJobRequest extends SaveJobParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
