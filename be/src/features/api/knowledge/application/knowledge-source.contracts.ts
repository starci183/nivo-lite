import type { DocumentAiCost } from "@modules/domain/ai-usage-events"
import type { OpenedKnowledgeSource } from "@modules/domain/knowledge"

/** What the KnowledgeSource operation takes. */
export interface KnowledgeSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}

/** One document with its text, its passages and what it cost in AI (null for a member who is not an owner or manager). */
export type KnowledgeSourceRead = OpenedKnowledgeSource & {
    /** Read, critique and re-read, exact credits; null for staff. */
    readonly aiCost: DocumentAiCost | null
}
