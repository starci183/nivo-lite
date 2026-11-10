import type { RelationKind } from "@modules/domain/brain-facts"

/** What the LinkBrainFacts operation takes. */
export interface LinkBrainFactsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The truth the edge starts from. */
    readonly fromFactId: string
    /** The truth it points at. */
    readonly toFactId: string
    /** How they relate. */
    readonly kind: RelationKind
    /** The relation in the owner's words. */
    readonly label?: string | undefined
}
