/** Format of a source: what the owner pasted or uploaded. */
export type SourceKind = "text" | "faq" | "file" | "url"

/** The kinds a source may have. */
export const SOURCE_KINDS: ReadonlyArray<SourceKind> = ["text", "faq", "file", "url"]

/** Where a source stands: queued, reading, indexing and extracting_facts are open work; `pending` is the older synchronous value. */
export type SourceStatus =
    "pending" | "queued" | "reading" | "indexing" | "extracting_facts" | "ready" | "failed" | "blocked_credits"

/** public: customer-facing agents may answer from it. internal: internal agents and staff only. */
export type Visibility = "public" | "internal"

/** The origin of a source written for an approved public document. */
export const PUBLIC_DOCUMENT_ORIGIN = "public_document"

/** The text of an approved public document, as it is written to its public source. */
export interface PublishedSourceInput {
    /** The title customers see in a citation. */
    readonly title: string
    /** The approved text. */
    readonly content: string
}

/** The most characters one source may hold; a longer text is split into several sources by its owner. */
export const MAX_SOURCE_CHARS = 120_000

/** The storage bucket of uploaded documents; objects live at `<workspaceId>/<uuid>/<filename>`. */
export const KNOWLEDGE_UPLOAD_BUCKET = "knowledge-uploads"

/** The content type of each document extension a knowledge upload is signed with; the extensions are the ones a document can be read from. */
export const KNOWLEDGE_UPLOAD_MIME: ReadonlyMap<string, string> = new Map([
    ["pdf", "application/pdf"],
    ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["txt", "text/plain"],
    ["md", "text/markdown"],
    ["markdown", "text/markdown"],
    ["csv", "text/csv"],
    ["tsv", "text/tab-separated-values"],
    ["html", "text/html"],
    ["htm", "text/html"],
    ["jpg", "image/jpeg"],
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
    ["gif", "image/gif"],
    ["heic", "image/heic"],
    ["heif", "image/heif"],
])

/** The extensions of old binary Office files: refused at the upload door with the advice to save them again as .docx or .xlsx. */
export const LEGACY_OFFICE_EXTENSIONS: ReadonlySet<string> = new Set(["doc", "xls", "ppt"])

/**
 * The Second Brain's documents limit (owner 2026-11-11: second brain data is its own limit for all workspaces, apart from the plan's
 * storage; the number: 50 MB on 2026-11-11, 20 MB then 10 MB on 2026-11-12): the raw bytes of a workspace's Second Brain sources (files
 * and pasted text) are at most this in total, the SAME for every workspace whatever its plan. It is not the plan's storage: that quota
 * (`plans.storage_gb`, e.g. Pro 20 GB) is the workspace's general storage, checked by `EntitlementsService.requireStorageFor` over
 * every stored object, and stays as it was. A Second Brain upload must pass both. Changing the number is this one line.
 */
export const BRAIN_DOCUMENTS_BYTES: number = 10 * 1024 * 1024

/**
 * The limit of ONE of the Second Brain's two upload areas (owner 2026-11-12: PUBLIC documents and INTERNAL documents, 5 MB each, 10 MB in
 * total): the raw bytes of the sources whose `visibility` is that area. Two areas of this size are the whole limit above.
 */
export const BRAIN_AREA_BYTES: number = 5 * 1024 * 1024

/** The largest uploaded document, in bytes: 50 MB, and never more than one area of the Second Brain may hold (5 MB today). */
export const MAX_UPLOAD_BYTES: number = Math.min(50 * 1024 * 1024, BRAIN_AREA_BYTES)

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
    /** The source has no passage to store. */
    NoPassages = "KNOWLEDGE_NOTE_NO_PASSAGES",
    /** The PDF has no text layer (a scan or photographs of pages): nothing was read, and it needs OCR before it can teach the agents. */
    NeedsOcr = "KNOWLEDGE_NOTE_NEEDS_OCR",
    /** The text is the same as a document the workspace already holds for the same readers: it was not read, embedded or filed again. */
    Duplicate = "KNOWLEDGE_NOTE_DUPLICATE",
    /** The file is locked with a password. */
    PasswordProtected = "KNOWLEDGE_NOTE_PASSWORD_PROTECTED",
    /** A Word or Excel file of the old binary format (.doc, .xls): it must be saved again as .docx or .xlsx. */
    LegacyOffice = "KNOWLEDGE_NOTE_LEGACY_OFFICE",
    /** The library that reads this kind of file is not installed on the server. */
    ReaderUnavailable = "KNOWLEDGE_NOTE_READER_UNAVAILABLE",
    /** The file is pictures only and the AI that transcribes pictures could not be reached. */
    TranscriptionUnavailable = "KNOWLEDGE_NOTE_TRANSCRIPTION_UNAVAILABLE",
    /** The file is pictures only and the workspace has no AI allowance left to transcribe them. */
    NoCreditsForTranscription = "KNOWLEDGE_NOTE_NO_CREDITS_TRANSCRIPTION",
    /** The file is not of a kind a document can be read from. */
    TypeUnsupported = "KNOWLEDGE_NOTE_TYPE_UNSUPPORTED",
}

/** One part of a document its last reading could not read whole, as the second-brain page shows it. */
export interface ReadingWarning {
    /** The note's code (`DOCUMENT_PAGE_UNREADABLE`, `DOCUMENT_PAGE_TRANSCRIBED`, `DOCUMENT_PAGES_OVER_LIMIT`, `DOCUMENT_ROWS_OVER_LIMIT`, `DOCUMENT_PLACE_EMPTY`). */
    readonly code: string
    /** The page number, sheet name or slide number, or null for the whole document. */
    readonly place: string | null
    /** The count the note names, or null. */
    readonly count: number | null
    /** The note in plain Vietnamese, e.g. the sentence "Page 3 could not be read." */
    readonly message: string
}

/** How the last reading of a file or link went, stored in `knowledge_sources.reading`. */
export interface SourceReading {
    /** The reader that read it: text, markdown, csv, tsv, html, pdf, docx, xlsx, pptx, image, heic, link. */
    readonly reader: string
    /** How many pages (PDF, picture) or slides it has, or null. */
    readonly pageCount: number | null
    /** How many sheets a workbook has, or null. */
    readonly sheetCount: number | null
    /** True when any of its text was transcribed by the AI from a picture. */
    readonly transcribed: boolean
    /** The parts it could not read whole. */
    readonly warnings: ReadonlyArray<ReadingWarning>
    /** The stored code of why the file was refused, or null when it was read. */
    readonly refusal: string | null
    /** Why it was refused, in plain Vietnamese, or null when it was read. */
    readonly reason: string | null
    /** When it was read, ISO 8601. */
    readonly readAt: string
    /** The stored object that was read (a file source), or null: a retry of the same object reuses a transcription instead of paying again. */
    readonly path: string | null
}

/** A reading, or null when the document has none. */
export type MaybeReading = SourceReading | null

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
    /** The area the member uploads into, `public` or `internal`; internal when omitted. */
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
    /** The area to move the document to, `public` or `internal` (the MOVE: its passages and truths follow). */
    readonly visibility?: string | undefined
}

/** A source to read again, optionally with new text. */
export interface ReindexInput {
    /** The source. */
    readonly sourceId: string
    /** The new text; omitted keeps the text. */
    readonly content?: string | undefined
    /** A new upload of the same document (`<workspaceId>/<uuid>/<filename>`), for a file source; omitted keeps the file. */
    readonly storagePath?: string | undefined
}

/** One source of one workspace. */
export interface SourceKey {
    /** The workspace that owns it. */
    readonly workspaceId: string
    /** The source. */
    readonly sourceId: string
}

/** A new upload of a document: its object and its size. */
export interface NewUpload {
    /** The object. */
    readonly path: string
    /** Its size in bytes. */
    readonly bytes: number
}

/** A new upload, or null when none was given. */
export type MaybeNewUpload = NewUpload | null

/** The path of a new upload the browser may not have given. */
export type OptionalUploadPath = string | undefined

/** The size in bytes the browser may not have said. */
export type OptionalSizeBytes = number | undefined

/** The columns a new upload writes on its source (empty without one). */
export interface ReplacementColumns {
    /** The new object. */
    readonly storagePath?: string
    /** Its size in bytes. */
    readonly sizeBytes?: number
    /** Cleared, so the index job reads the new file instead of keeping the text it knew. */
    readonly contentHash?: null
}

/** What a new upload changes on the file of a source, and the object it replaces. */
export interface FileReplacement {
    /** The columns to write. */
    readonly columns: ReplacementColumns
    /** The old object, to remove once the change is written; null when there is none (no upload, or the same object again). */
    readonly replaced: string | null
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
    /** The later parts of a long document that went with it, each with the title the brain files its note under. */
    readonly parts: ReadonlyArray<{ readonly id: string; readonly title: string }>
}

/** An address a browser uploads one document to. */
export interface UploadAddress {
    /** The object path to give back when the source is added. */
    readonly path: string
    /** The one-time upload token. */
    readonly token: string
    /** The signed address to PUT the file to. */
    readonly signedUrl: string
    /** The content type the address is signed for: the upload must send exactly this `Content-Type`. */
    readonly contentType: string
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
    /** The SHA-256 of the text whose passages and facts are complete, or null while the work is unfinished. */
    readonly contentHash: string | null
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
    /** Where it came from when it was not typed or uploaded by hand (`google_drive`, a seed or a public document), or null. */
    readonly origin: string | null
    /** 0-100 while a worker is on it. */
    readonly progress: number
    /** The stage the document is at (read, chunk, embed, store, facts, or critic while the critic checks it), or null when none is. */
    readonly stage: "read" | "chunk" | "embed" | "store" | "facts" | "critic" | null
    /** Passages of the stage that are done, or null. */
    readonly stageDone: number | null
    /** Passages of the stage in all, or null. */
    readonly stageTotal: number | null
    /** Creation instant, ISO 8601. */
    readonly createdAt: string
    /** Last change, ISO 8601. */
    readonly updatedAt: string
    /** How many parts the document is cut into: 1 for a document that fits one source. */
    readonly partCount: number
}

/** A source with its text. */
export interface SourceDetail extends SourceSummary {
    /** The text (the address of a link source until it is read). */
    readonly content: string
    /** How its last reading went, or null when it has none (a note, or a document read before readings were kept); absent where not read. */
    readonly reading?: MaybeReading
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

/** An indexed document an agent view may list, without its text. */
export type ReadableSummary = Omit<ReadableSource, "content">

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
