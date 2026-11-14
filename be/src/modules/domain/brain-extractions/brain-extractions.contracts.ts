import { isRecord } from "@modules/platform/primitives"

/**
 * Where the truths work of one document stands. `blocked_credits`: the credit pool is empty; `at_ceiling`: the business holds its
 * ceiling of truths in force. Both wait and go on by themselves (`PARKED`); nothing is lost in either. `awaiting_critique` is no longer
 * written (a document's truths settle as soon as its own reading ends, owner 2026-11-12): it stays a stored value of readings an
 * earlier build parked, which the upkeep tick lets go on once.
 */
export type ExtractionStatus =
    "queued" | "running" | "done" | "failed" | "blocked_credits" | "awaiting_critique" | "at_ceiling"

/** The statuses in which a reading waits for something outside it and is looked at again by the upkeep tick. */
export const PARKED: ReadonlyArray<ExtractionStatus> = ["blocked_credits", "awaiting_critique", "at_ceiling"]

/** The stage of the truths work: which passages state a rule, the truths of those, then what goes in force. */
export type ExtractionStage = "triage" | "extract" | "settle"

/** The counts a truths work shows: passages judged and kept, truths in force, asked about and waiting. */
export interface TruthCounts {
    /** The passages of the document. */
    readonly passagesTotal: number
    /** The passages triage has judged. */
    readonly passagesTriaged: number
    /** The passages that state a rule of the shop. */
    readonly passagesKept: number
    /** Truths put in force directly. */
    readonly factsApplied: number
    /** Truths the founder is asked about. */
    readonly factsAsked: number
    /** Truths that wait (not the founder's document, not critiqued yet, or over the ceiling). */
    readonly factsWaiting: number
}

/** The stored codes of why a reading failed; the front end shows its own text for each. */
export enum ExtractionNote {
    /** The model did not answer. */
    ModelBusy = "BRAIN_NOTE_MODEL_BUSY",
    /** The model answered something that could not be read. */
    AnswerUnreadable = "BRAIN_NOTE_ANSWER_UNREADABLE",
    /** The reading stopped on an error and its retries ran out. */
    Aborted = "BRAIN_NOTE_READING_ABORTED",
    /**
     * Not a failure: the document was read by the pipeline before the passage stages (INGEST-2), so it has no passage counts; its truths
     * stay what that reading filed. "Read again" (`reindexKnowledgeSource`) takes it through the stages.
     */
    ReadOldWay = "BRAIN_NOTE_READ_OLD_WAY",
    /**
     * Not a failure: the reading ended, but some of its calls could not be read even after a follow-up and were skipped (`callsSkipped`
     * of them); their passages are read again by the next reading ("read again").
     */
    WindowsSkipped = "BRAIN_NOTE_WINDOWS_SKIPPED",
    /**
     * Not a failure: the reading ended, but lines of the answers were refused (`linesRefused`: not a truth line, or a value the passage
     * does not hold) and NOTHING was filed from the document's rule passages.
     */
    LinesRefused = "BRAIN_NOTE_LINES_REFUSED",
    /**
     * Not a failure: the reading ended, but lines of rule passages were neither read into a truth nor skipped by the reading even after
     * a follow-up (`linesUnread` of them, kept in the reading's notes): the founder may read them; "read again" asks once more.
     */
    LinesUnread = "BRAIN_NOTE_LINES_UNREAD",
    /** The reading ended; the document is not the founder's, so its truths wait for the founder's yes (`truthsWaiting` of them). */
    AwaitingFounder = "BRAIN_NOTE_AWAITING_FOUNDER",
}

/** The note a finished reading keeps (`BrainExtractionsService.finish`), or null when nothing needs saying. */
export type EndNote = ExtractionNote | null

/** Why an answer of the truth reading is kept in the reading's notes. */
export type AnswerNoteReason = "unreadable" | "cut" | "empty" | "refused" | "unaccounted"

/**
 * One refused or skipped answer of a reading, kept in the tenant's row (`brain_extractions.answer_notes`, the last 20), never logged: the
 * raw reply may quote the document.
 */
export interface AnswerNote {
    /** When, ISO 8601. */
    readonly at: string
    /** Why it is kept. */
    readonly reason: AnswerNoteReason
    /** The passages of the call. */
    readonly passages: ReadonlyArray<string>
    /** How many lines of it were refused. */
    readonly refused: number
    /** The raw reply (or, for `refused`, the refused lines), cut to 1,000 characters. */
    readonly answer: string
}

/** What one window of a reading adds to the reading's notes. */
export interface WindowNote {
    /** True when the window was skipped. */
    readonly skipped: boolean
    /** Lines of rule material the window neither read nor skipped (TRIAGE-3); absent = 0. */
    readonly unread?: number
    /** The note. */
    readonly note: AnswerNote
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
    /** The stage it is at, or null for a reading from before the stages. */
    readonly stage: ExtractionStage | null
    /** Its counts. */
    readonly counts: TruthCounts
    /** Reading calls skipped (their answer could not be read even after a follow-up). */
    readonly windowsSkipped: number
    /** Answer lines refused over the reading. */
    readonly linesRefused: number
    /** Lines of rule material neither read nor skipped over the reading. */
    readonly linesUnread?: number
    /** When the row last changed: the episode a report of this reading is keyed by. */
    readonly updatedAt: Date
    /** What the document is (TRIAGE-2: the model's reading, or the founder's answer over it), or null while it was not judged. */
    readonly nature?: DocumentNatureView | null
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
    /** How many passages the document has. */
    readonly passagesTotal: number
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
    /** The stage, when the save moves it. */
    readonly stage?: ExtractionStage
    /** The counts the save changes. */
    readonly counts?: Partial<TruthCounts>
}

/** A reading that waits for credits, as the upkeep tick that resumes it reads it. */
export interface BlockedExtraction {
    /** The workspace. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
    /** A hash of the text being read. */
    readonly contentHash: string | null
    /** Windows read. */
    readonly windowsDone: number
    /** Windows of the reading. */
    readonly windowsTotal: number
    /** What it waits for. */
    readonly status: ExtractionStatus
}

/** The reading of one document as the Second Brain page shows it. */
export interface ExtractionState {
    /** The document. */
    readonly sourceId: string
    /** Where the reading stands. */
    readonly status: ExtractionStatus
}

/**
 * What a document IS, as the documents page shows it (TRIAGE-2): the judgement its passages inherit. `nature`: `rules`, `records`,
 * `log`, `reference` or `mixed`; `by`: `model`, `founder` (his answer over the model's) or `fallback` (no readable answer: every
 * passage was triaged one by one). Only rule material is read into truths; the rest is stored and searchable.
 */
export interface DocumentNatureView {
    /** The nature in force. */
    readonly nature: string
    /** Who decided it. */
    readonly by: string
    /** The model's line of reason (kept when the founder answered: the page shows both). */
    readonly reason: string
    /** What the model said, when the founder's answer replaced it; else null. */
    readonly modelNature: string | null
    /** For a mixed document: how many of its sections are rule material (the rest file no truth). */
    readonly ruleSections: number | null
    /** For a mixed document: how many sections it has. */
    readonly sections: number | null
    /** The quotes of the text the model's judgement rests on (TRIAGE-6); empty when none was found in the text. */
    readonly evidence?: ReadonlyArray<string>
    /** Documents of the same form judged otherwise (their ids): the founder is shown the disagreement (TRIAGE-6). */
    readonly disagreesWith?: ReadonlyArray<string>
}

/** A stored jsonb judgement of what a document is (shaped by the brain's nature policy). */
export type NatureJson = Record<string, unknown>

/** A stored jsonb judgement, or null when there is none. */
export type MaybeNatureJson = NatureJson | null

/** An instant, or null when there is none. */
export type MaybeInstant = Date | null

/** The stored judgement of a reading: the model's reading and the founder's answer, as jsonb (shaped by the brain's nature policy). */
export interface StoredNature {
    /** The model's reading, or null when not read yet. */
    readonly reading: MaybeNatureJson
    /** The founder's answer, or null. */
    readonly override: MaybeNatureJson
}

/** A document of the same form and its stored model reading (TRIAGE-6). */
export interface StoredFormMate {
    /** The document. */
    readonly sourceId: string
    /** Its stored model reading (jsonb, shaped by the brain's nature policy). */
    readonly reading: Record<string, unknown>
    /** Its title. */
    readonly title: string
}

/** How far the reading of one document got, as the truth graph's list of sources shows it. */
export interface ExtractionProgressView extends ExtractionState {
    /** Windows read. */
    readonly windowsDone: number
    /** Windows the reading has (only the changed passages on a partial reading). */
    readonly windowsTotal: number
    /** Facts filed by the reading. */
    readonly factsProposed: number
    /** The stage it is at, or null for a reading from before the stages. */
    readonly stage: ExtractionStage | null
    /** A stored code of why it stopped or waits, or null. */
    readonly error: string | null
    /** Its counts. */
    readonly counts: TruthCounts
    /** Reading calls skipped. */
    readonly windowsSkipped: number
    /** Answer lines refused. */
    readonly linesRefused: number
    /** Lines of rule material neither read nor skipped. */
    readonly linesUnread?: number
    /** What the document is, or null while it was not judged. */
    readonly nature?: DocumentNatureView | null
}

/**
 * The state the documents page shows: a reading's status, or `legacy` for a document read before the passage stages (a `done` reading
 * with no stage): its passage counts were never kept, so it never reads `done` with zero passages.
 */
export type DocumentTruthsState = ExtractionStatus | "legacy"

/** Where the truths of one document stand, as the documents page reads it. */
export interface DocumentTruthsView {
    /**
     * `running`, `done`, `failed`, a waiting state (`blocked_credits`, `awaiting_critique`, `at_ceiling`), or `legacy` (read the old
     * way, note `BRAIN_NOTE_READ_OLD_WAY`).
     */
    readonly state: DocumentTruthsState
    /** The stage it is at, or null for a document read before the stages. */
    readonly stage: ExtractionStage | null
    /** A stored code of why it stopped or waits, or null. */
    readonly note: string | null
    /** The passages of the document. */
    readonly passagesTotal: number
    /** The passages triage has judged. */
    readonly passagesTriaged: number
    /** The passages that state a rule of the shop. */
    readonly passagesKept: number
    /** Reading calls done. */
    readonly callsDone: number
    /** Reading calls in all. */
    readonly callsTotal: number
    /** Truths filed from the document. */
    readonly truthsFound: number
    /** Truths put in force directly. */
    readonly truthsInForce: number
    /** Truths the founder is asked about. */
    readonly truthsAsked: number
    /** Truths that wait. */
    readonly truthsWaiting: number
    /** Reading calls skipped: their answer could not be read; the next reading reads their passages again. */
    readonly callsSkipped: number
    /** Answer lines refused (not a truth line, or a value the passage does not hold). */
    readonly linesRefused: number
    /** Lines of rule material neither read into a truth nor skipped, even after a follow-up (TRIAGE-3); kept in the reading's notes. */
    readonly linesUnread?: number
    /** What the document is (TRIAGE-2), or null while it was not judged. */
    readonly nature?: DocumentNatureView | null
}

/** The truths state of a document, or null while no truths work has started for it. */
export type MaybeDocumentTruths = DocumentTruthsView | null

/**
 * Whether a reading was made by the pipeline before the passage stages: it ended `done` with no stage. Every reading of today starts at
 * `triage` and keeps its stage when it ends (`BrainExtractionsService.start`, `finish`), so only an old reading has none.
 */
const readOldWay = (progress: ExtractionProgressView): boolean => progress.status === "done" && progress.stage === null

/**
 * The truths state of a document as the documents page reads it, from how far its reading got. A document read the old way says so
 * (`legacy`, `BRAIN_NOTE_READ_OLD_WAY`) with the truths it filed; its passage counts are zero because they were never kept.
 */
export const documentTruthsOf = (progress: ExtractionProgressView): DocumentTruthsView => ({
    state: readOldWay(progress) ? "legacy" : progress.status,
    stage: progress.stage,
    note: readOldWay(progress) ? ExtractionNote.ReadOldWay : progress.error,
    passagesTotal: progress.counts.passagesTotal,
    passagesTriaged: progress.counts.passagesTriaged,
    passagesKept: progress.counts.passagesKept,
    callsDone: progress.windowsDone,
    callsTotal: progress.windowsTotal,
    truthsFound: progress.factsProposed,
    truthsInForce: progress.counts.factsApplied,
    truthsAsked: progress.counts.factsAsked,
    truthsWaiting: progress.counts.factsWaiting,
    callsSkipped: progress.windowsSkipped,
    linesRefused: progress.linesRefused,
    linesUnread: progress.linesUnread ?? 0,
    nature: progress.nature ?? null,
})

/** A text field of a stored jsonb object, or null. */
const textField = (value: Record<string, unknown> | null, name: string): string | null => {
    const field = value?.[name]
    return typeof field === "string" ? field : null
}

/**
 * What a document is, as the page shows it, from the stored judgement (shape only: the brain's nature policy writes it): the founder's
 * answer over the model's reading; null while neither exists.
 */
export const natureViewOf = (stored: StoredNature): DocumentNatureView | null => {
    const modelNature = textField(stored.reading, "nature")
    const founder = textField(stored.override, "nature")
    if (modelNature === null && founder === null) return null
    const sections = stored.reading?.["sections"]
    const mixed = founder === null && modelNature === "mixed" && Array.isArray(sections)
    return {
        nature: founder ?? modelNature ?? "",
        by: founder !== null ? "founder" : (textField(stored.reading, "by") ?? "model"),
        reason: textField(stored.reading, "reason") ?? "",
        modelNature: founder === null ? null : modelNature,
        // An unlabelled section of a mixed document is rule material (`inheritedOf`).
        ruleSections: mixed ? sections.filter((one) => one === null || one === "rules").length : null,
        sections: mixed ? sections.length : null,
        evidence: stringsOf(stored.reading?.["evidence"]),
        disagreesWith: idsOf(stored.reading?.["disagreesWith"]),
    }
}

/** The strings of a stored list (shape only). */
const stringsOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []

/** The source ids of a stored list of mates (shape only). */
const idsOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value)
        ? value.flatMap((one: unknown) => {
              const id = isRecord(one) ? one["sourceId"] : undefined
              return typeof id === "string" ? [id] : []
          })
        : []
