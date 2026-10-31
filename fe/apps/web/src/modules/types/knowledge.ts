/** Where a document stands: the job queue moves it queued, reading, indexing, extracting_facts, then ready (or failed or blocked_credits). */
export type DocumentStatus =
    "pending" | "queued" | "reading" | "indexing" | "extracting_facts" | "ready" | "failed" | "blocked_credits"

/** What the owner added: a note, a Q&A list, an uploaded file or a link. */
export type DocumentKind = "text" | "faq" | "file" | "url"

/** public: customer-facing agents may answer from it. internal: internal agents and staff only. */
export type DocumentVisibility = "public" | "internal"

/** The decision an owner took on a suggestion. */
export type IdeaDecision = "dismissed" | "not_applicable"

/** The kinds of the base knowledge of NIVO. */
export type NivoItemKind = "playbook" | "authority" | "escalation" | "setup_checklist" | "tone"

/** One document of the workspace, as the pages show it. */
export interface KnowledgeDocument {
    readonly id: string
    readonly workspaceId: string
    /** The module the document is for; null = every module. */
    readonly module: string | null
    /** The one agent instance that reads it; null = every instance. */
    readonly installationId: string | null
    readonly kind: DocumentKind
    readonly topic: string | null
    readonly tags: ReadonlyArray<string>
    readonly visibility: DocumentVisibility
    readonly title: string
    readonly status: DocumentStatus
    /** A stored code of a failure or a note on a ready document. */
    readonly error: string | null
    readonly chunkCount: number
    /** 0-100 while a worker is on it. */
    readonly progress: number
    /** The stage a worker is on, or null when none is. */
    readonly stage: string | null
    readonly stageDone: number | null
    readonly stageTotal: number | null
    readonly createdAt: string
    readonly updatedAt: string
}

/** A document with its text. */
export interface KnowledgeDocumentDetail extends KnowledgeDocument {
    readonly content: string
}

/** One stored passage of a document. */
export interface DocumentPassage {
    readonly id: string
    readonly ord: number
    readonly content: string
    readonly hasEmbedding: boolean
}

/** One item of the base knowledge of NIVO. */
export interface NivoEntry {
    readonly id: string
    readonly module: string
    readonly slug: string
    readonly title: string
    readonly body: string
    readonly kind: NivoItemKind
    readonly version: number
    readonly updatedAt: string
}
