import type { DocumentAiCost } from "@modules/domain/ai-usage-events"
import type { SourceSummary } from "@modules/domain/knowledge-sources"

/** What the KnowledgeSources operation takes. */
export interface KnowledgeSourcesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only the documents of this module. */
    readonly module?: string | undefined
    /** Only the documents that came from this origin, e.g. `google_drive`. */
    readonly origin?: string | undefined
}

/** One document of the list with what it cost in AI: null for a member who is not an owner or manager. */
export type KnowledgeSourceListing = SourceSummary & {
    /** Read, critique and re-read, exact credits; null for staff. */
    readonly aiCost: DocumentAiCost | null
}
