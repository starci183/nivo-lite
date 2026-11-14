import type { BrainFactsAsk } from "@modules/domain/brain"

/** What the GetBrain operation takes. */
export interface GetBrainRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Which page of the facts (BRAIN-LIMITS item 4); absent: the first page of 2,000 with the default statuses. */
    readonly facts?: BrainFactsAsk | null | undefined
}
