/** Format of a source: what the owner pasted or uploaded. */
export type SourceKind = "text" | "faq" | "file" | "url"

/** The kinds a source may have. */
export const SOURCE_KINDS: ReadonlyArray<SourceKind> = ["text", "faq", "file", "url"]

/** Where a source stands: queued, reading, indexing and extracting_facts are open work; `pending` is the older synchronous value. */
export type SourceStatus =
    "pending" | "queued" | "reading" | "indexing" | "extracting_facts" | "ready" | "failed" | "blocked_credits"

/** public: customer-facing agents may answer from it. internal: internal agents and staff only. */
export type Visibility = "public" | "internal"

/** The most characters one source may hold; a longer text is split into several sources by its owner. */
export const MAX_SOURCE_CHARS = 120_000

/** The storage bucket of uploaded documents; objects live at `<workspaceId>/<uuid>/<filename>`. */
export const KNOWLEDGE_UPLOAD_BUCKET = "knowledge-uploads"

/** The largest uploaded document, in bytes: 50 MB. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** The most raw document data one workspace may index in total, in bytes: 50 MB. */
export const WORKSPACE_SOURCE_BYTES = 50 * 1024 * 1024

/** How much of its raw document allowance a workspace has used. */
export interface KnowledgeUsage {
    /** The raw bytes its sources hold now. */
    readonly usedBytes: number
    /** The most raw bytes it may hold. */
    readonly limitBytes: number
}

/** The storage path of an uploaded file, or null for a source that has none. */
export type MaybeStoragePath = string | null

/** The notes and failure codes stored in `knowledge_sources.error`; the front end shows its own text for each. */
export enum StoredNote {
    /** Passages are stored with no vector: they are found by keyword only. */
    KeywordOnly = "KNOWLEDGE_NOTE_KEYWORD_ONLY",
    /** A large document was stored without vectors because the workspace has no credits left. */
    NoCreditsForIndex = "KNOWLEDGE_NOTE_NO_CREDITS_INDEX",
    /** The document is stored and searchable but its facts were not read because the workspace has no credits left. */
    NoCreditsForFacts = "KNOWLEDGE_NOTE_NO_CREDITS_FACTS",
    /** The document is stored and searchable but its facts could not be read. */
    FactsUnread = "KNOWLEDGE_NOTE_FACTS_UNREAD",
    /** The uploaded file is not in storage. */
    FileMissing = "KNOWLEDGE_NOTE_FILE_MISSING",
    /** The uploaded file is larger than a document may be. */
    FileTooLarge = "KNOWLEDGE_NOTE_FILE_TOO_LARGE",
    /** The source cannot be read and nothing more specific is known. */
    Unreadable = "KNOWLEDGE_NOTE_UNREADABLE",
    /** The source has no text. */
    Empty = "KNOWLEDGE_NOTE_EMPTY",
    /** The text is longer than a source may hold. */
    TooLong = "KNOWLEDGE_NOTE_TOO_LONG",
    /** The source has no passage to store. */
    NoPassages = "KNOWLEDGE_NOTE_NO_PASSAGES",
}

/** What a person adds: a note, a Q&A list, an uploaded file or a link. */
export interface AddSourceInput {
    /** text, faq, file or url. */
    readonly kind: string
    /** The title; a link or file without one is titled from its address or name. */
    readonly title: string
    /** The text of a note or Q&A list. */
    readonly content?: string | undefined
    /** The address of a link source. */
    readonly url?: string | undefined
    /** The storage object of an uploaded file: `<workspaceId>/<uuid>/<filename>`. */
    readonly storagePath?: string | undefined
    /** The topic label. */
    readonly topic?: string | undefined
    /** The tags. */
    readonly tags?: ReadonlyArray<string> | undefined
    /** The module (agent type) the document is for; omitted = every module. */
    readonly module?: string | undefined
    /** The agent instance that alone reads the document; omitted = every instance. */
    readonly installationId?: string | undefined
    /** public or internal; internal when omitted. */
    readonly visibility?: string | undefined
    /** Where it came from: a folder, a ZIP, the Google Picker. */
    readonly origin?: string | undefined
}

/** What changes about a source without re-reading it. */
export interface UpdateSourceInput {
    /** The source. */
    readonly sourceId: string
    /** A new title. */
    readonly title?: string | undefined
    /** A new topic; an empty text clears it. */
    readonly topic?: string | undefined
    /** New tags. */
    readonly tags?: ReadonlyArray<string> | undefined
    /** A new module; an empty text means every module. */
    readonly module?: string | undefined
    /** public or internal. */
    readonly visibility?: string | undefined
}

/** A source to read again, optionally with new text. */
export interface ReindexInput {
    /** The source. */
    readonly sourceId: string
    /** The new text; omitted keeps the text. */
    readonly content?: string | undefined
}

/** The identity of a source that was just written. */
export interface SourceRef {
    /** The source id. */
    readonly id: string
}

/** The title of the source that was just deleted. */
export interface DeletedSource {
    /** Its title, for the note the brain files about the withdrawal. */
    readonly title: string
}

/** An address a browser uploads one document to. */
export interface UploadAddress {
    /** The object path to give back when the source is added. */
    readonly path: string
    /** The one-time upload token. */
    readonly token: string
    /** The signed address to PUT the file to. */
    readonly signedUrl: string
}

/** A source as the jobs read it. */
export interface SourceRecord {
    /** The source id. */
    readonly id: string
    /** The owning workspace. */
    readonly workspaceId: string
    /** The module, or null for every module. */
    readonly module: string | null
    /** The agent instance, or null for every instance. */
    readonly installationId: string | null
    /** text, faq, file or url. */
    readonly kind: string
    /** The topic. */
    readonly topic: string | null
    /** public or internal. */
    readonly visibility: string
    /** The title. */
    readonly title: string
    /** The text (the address of a link source until it is read). */
    readonly content: string
    /** Where the source stands. */
    readonly status: string
    /** The storage object of a file source. */
    readonly storagePath: string | null
    /** The address of a link source. */
    readonly sourceUrl: string | null
    /** Who added it; null for an API key. */
    readonly createdBy: string | null
    /** Last change. */
    readonly updatedAt: string
}

/** A source, or null when it is gone. */
export type MaybeSource = SourceRecord | null

/** A stored note, or null when there is none to store. */
export type MaybeNote = StoredNote | null

/** An uploaded document as storage holds it. */
export interface UploadedFile {
    /** The bytes. */
    readonly bytes: Uint8Array
    /** The content type storage recorded. */
    readonly contentType: string
}

/** An uploaded document, or null when the object is not in storage. */
export type MaybeUploadedFile = UploadedFile | null

/** The code storage answers for an object that is not there. */
export const STORAGE_OBJECT_MISSING = "OBJECT_STORAGE_NOT_FOUND"

/** A source as the Knowledge page lists it: everything but the text. */
export interface SourceSummary {
    /** The source id. */
    readonly id: string
    /** The owning workspace. */
    readonly workspaceId: string
    /** The module, or null for every module. */
    readonly module: string | null
    /** The agent instance, or null for every instance. */
    readonly installationId: string | null
    /** text, faq, file or url. */
    readonly kind: string
    /** The topic. */
    readonly topic: string | null
    /** The tags. */
    readonly tags: ReadonlyArray<string>
    /** public or internal. */
    readonly visibility: string
    /** The title. */
    readonly title: string
    /** Where the source stands. */
    readonly status: string
    /** A stored code or note, or null. */
    readonly error: string | null
    /** How many passages are stored. */
    readonly chunkCount: number
    /** The raw bytes it holds: the uploaded file, or the pasted text. */
    readonly sizeBytes: number
    /** 0-100 while a worker is on it. */
    readonly progress: number
    /** The stage a worker is on (read, chunk, embed, store or facts), or null when none is. */
    readonly stage: "read" | "chunk" | "embed" | "store" | "facts" | null
    /** Passages of the stage that are done, or null. */
    readonly stageDone: number | null
    /** Passages of the stage in all, or null. */
    readonly stageTotal: number | null
    /** Creation instant, ISO 8601. */
    readonly createdAt: string
    /** Last change, ISO 8601. */
    readonly updatedAt: string
}

/** A source with its text. */
export interface SourceDetail extends SourceSummary {
    /** The text (the address of a link source until it is read). */
    readonly content: string
}

/** Who may read a document: anyone (public) or the team only (internal); a customer-facing view never counts internal ones. */
export type DocumentVisibility = "public" | "internal"

/** The view of one agent over the documents: its workspace, module, instance and audience. */
export interface ReadableScope {
    /** The workspace. */
    readonly workspaceId: string
    /** The module of the agent. */
    readonly module: string
    /** The agent instance, or null for the shared documents only. */
    readonly installationId: string | null
    /** customer reads public documents only; internal reads both. */
    readonly audience: "customer" | "internal"
}

/** An indexed document an agent may read, with its text. */
export interface ReadableSource {
    /** The source id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The topic, or null. */
    readonly topic: string | null
    /** The kind of source. */
    readonly kind: string
    /** Who may see it. */
    readonly visibility: "public" | "internal"
    /** When it last changed, ISO 8601. */
    readonly updatedAt: string
    /** The text. */
    readonly content: string
}

/** One text document a workspace configuration run keeps, found again by its origin and title. */
export interface ProfileSourceInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The workspace owner, recorded as the creator. */
    readonly ownerId: string
    /** The origin that marks the run's own documents, e.g. `seed:<profile>`. */
    readonly origin: string
    /** The title; the key together with the origin. */
    readonly title: string
    /** The topic label. */
    readonly topic: string
    /** The module that reads it; null = every module. */
    readonly module: string | null
    /** Who may read it. */
    readonly visibility: "public" | "internal"
    /** The markdown text. */
    readonly content: string
}

/** What keeping one document did: a new row, a changed text queued again, or nothing. */
export type ProfileSourceOutcome = "inserted" | "requeued" | "unchanged"

/** What a search result shows of the source of a passage. */
export interface SourceBrief {
    /** The source id. */
    readonly id: string
    /** text, faq, file or url. */
    readonly kind: string
    /** The title. */
    readonly title: string
    /** The topic, or null. */
    readonly topic: string | null
}

/** What the documents of one category (their `topic`) hold together. */
export interface SourceCategory {
    /** The topic label the documents share. */
    readonly topic: string
    /** The number its folder carries, from the folder:<n> tag of its documents; null when no document carries one. */
    readonly order: number | null
    /** How many documents carry it. */
    readonly documentCount: number
    /** The raw bytes those documents hold. */
    readonly sizeBytes: number
}

/** How many documents a category holds for one dossier reference: the leading number of a title, or a `dossier:<n>` tag. */
export interface DossierDocumentCount {
    /** The topic label (the category) of the documents. */
    readonly topic: string
    /** The dossier reference, without leading zeros. */
    readonly ref: string
    /** How many documents name that reference. */
    readonly documentCount: number
}
