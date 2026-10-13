import type { MoveCandidateParams } from "@modules/domain/hiring"

/** What move a candidate to another stage takes. */
export interface MoveHiringCandidateRequest extends MoveCandidateParams {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
