/** Where the reading of one document stands. */
export type ExtractionStatus = "queued" | "running" | "done" | "failed" | "blocked_credits"

/** The stored codes of why a reading failed; the front end shows its own text for each. */
export enum ExtractionNote {
    /** The model did not answer. */
    ModelBusy = "BRAIN_NOTE_MODEL_BUSY",
    /** The model answered something that could not be read. */
    AnswerUnreadable = "BRAIN_NOTE_ANSWER_UNREADABLE",
    /** The reading stopped on an error and its retries ran out. */
    Aborted = "BRAIN_NOTE_READING_ABORTED",
}

/** Where the reading of one document stands. */
export interface ExtractionRecord {
    /** The document. */
    readonly sourceId: string
    /** Where the reading stands. */
    readonly status: ExtractionStatus
    /** How many facts were filed from the document. */
    readonly factsProposed: number
    /** The prompt version that read it. */
    readonly promptVersion: number
    /** A hash of the text that was read. */
    readonly contentHash: string | null
    /** How many windows the document has. */
    readonly windowsTotal: number
    /** How many windows were read. */
    readonly windowsDone: number
    /** How many tries failed in a row. */
    readonly attempts: number
    /** Active facts that lost their last evidence when the document changed. */
    readonly orphanFactIds: ReadonlyArray<string>
    /** The hashes of the passages the last finished reading covered. */
    readonly passageHashes: ReadonlyArray<string>
    /** Whether this reading already withdrew facts. */
    readonly factsChanged: boolean
}

/** A reading, or null when there is none. */
export type MaybeExtraction = ExtractionRecord | null

/** A reading to start. */
export interface ExtractionStart {
    /** The workspace. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** The prompt version that will read it. */
    readonly promptVersion: number
    /** A hash of the text to read. */
    readonly contentHash: string
    /** How many windows the document has. */
    readonly windowsTotal: number
    /** Active facts that lost their evidence and wait for the new reading. */
    readonly orphanFactIds: ReadonlyArray<string>
    /** Whether starting this reading withdrew facts. */
    readonly factsChanged: boolean
}

/** How far a reading got. */
export interface ExtractionProgress {
    /** The status. */
    readonly status: ExtractionStatus
    /** Windows read. */
    readonly windowsDone: number
    /** Facts filed. */
    readonly factsProposed: number
    /** Windows the document has. */
    readonly windowsTotal: number
    /** A stored code, or null. */
    readonly error: ExtractionNote | string | null
    /** Tries that failed in a row. */
    readonly attempts: number
}

/** The reading of one document as the Second Brain page shows it. */
export interface ExtractionState {
    /** The document. */
    readonly sourceId: string
    /** Where the reading stands. */
    readonly status: ExtractionStatus
}
