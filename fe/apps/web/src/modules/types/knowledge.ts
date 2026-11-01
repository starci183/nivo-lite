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
    /** How many parts the document is cut into when it is longer than a source may be; 1 otherwise. */
    readonly partCount: number
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

/** One link input. */
export interface LinkRowView {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly error?: string | undefined
}

/** One file or link waiting to be added, already worded. */
export interface QueueRowView {
    readonly id: string
    readonly name: string
    readonly detail: string
    readonly statusLabel: string
    readonly statusTone: "neutral" | "warning" | "success" | "danger"
    readonly error?: string | undefined
    readonly canRemove: boolean
    /** The words of the button that sends only this failed file again; absent when it cannot be retried. */
    readonly retryLabel?: string | undefined
}

/** The bytes of the batch on their way to storage. */
export interface BatchBytesView {
    readonly label: string
    /** 0 to 100, by bytes. */
    readonly value: number
    readonly valueText: string
}

/** The notice that uploads stopped when the page reloaded. */
export interface StoppedUploadsView {
    readonly text: string
    readonly dismissLabel: string
    /** Reopens the file picker: a browser cannot resume a file after a reload. */
    readonly pickLabel: string
}
