import type { BrandDecision } from "@modules/domain/content-ai"

/** Confirms or rejects a brand proposal. */
export interface DecideBrandProposalRequest {
    /** The workspaceId. */
    readonly workspaceId: string
    /** The proposalId. */
    readonly proposalId: string
    /** The decision. */
    readonly decision: BrandDecision
}
