import type { FounderNature } from "@modules/domain/brain"

/** What the SetKnowledgeSourceNature operation takes. */
export interface SetKnowledgeSourceNatureRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves the caller is its founder. */
    readonly workspaceId: string
    /** The document (any of its parts). */
    readonly sourceId: string
    /** What the founder says the document is; undefined takes his answer back (the model's reading stands). */
    readonly nature: FounderNature
}
