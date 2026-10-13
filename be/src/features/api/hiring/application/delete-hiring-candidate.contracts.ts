import type { DeleteCandidateParams } from "@modules/domain/hiring"

/** What delete a candidate with every trace takes. */
export interface DeleteHiringCandidateRequest extends DeleteCandidateParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
