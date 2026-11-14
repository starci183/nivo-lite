import type { ExtractionStage, AnswerNoteReason, TruthCounts } from "@modules/domain/brain-extractions"
import type { Evidence, FactRecord } from "@modules/domain/brain-facts"
import type { TriageVerdict, TruthPassage } from "@modules/domain/knowledge-chunks"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import type { AiBudget, AiChatAnswer, AiChatAttempt, AiMessage } from "@modules/integrations/ai"
import type { Reading, StageEnd } from "./document-truths.contracts"
import type { DocumentDate, ExtractedFact, FollowUp, ParsedFacts } from "./extraction.policy"

/**
 * The shapes and the pure rules of one window of a document's truths work (`DocumentTruthStagesService`): when a try wrote nothing
 * usable, how a cut batch splits, when a window's answer is asked once more and which answer is kept, the evidence a truth carries.
 */

/** The finish reasons of an answer cut at its token cap, as the endpoints say them. */
const CUT_REASONS: ReadonlySet<string> = new Set(["length", "max_tokens"])

/**
 * Whether a try gave no usable answer because of what it WROTE (cut at its token cap, by its failure or its finish reason, or empty):
 * the same prompt would write the same again, so it is never simply retried. A try that wrote nothing (a timeout, a provider error, no
 * key) is the model's moment, retried by the queue.
 */
export const wroteNothingUsable = (tried: AiChatAttempt): boolean =>
    !tried.ok &&
    (tried.failure === "length" || tried.failure === "empty" || CUT_REASONS.has(tried.spent?.served.finishReason ?? ""))

/** Whether a try was cut at its token cap. */
export const cutOf = (tried: AiChatAttempt): boolean =>
    !tried.ok && (tried.failure === "length" || CUT_REASONS.has(tried.spent?.served.finishReason ?? ""))

/** A batch cut in two halves, the first one the larger. */
export const halvesOf = <T>(batch: ReadonlyArray<T>): ReadonlyArray<ReadonlyArray<T>> => {
    const middle = Math.ceil(batch.length / 2)
    return [batch.slice(0, middle), batch.slice(middle)]
}

/** The batches of a stage with the one at `index` replaced by its two halves. */
export const splitAt = <T>(batches: ReadonlyArray<ReadonlyArray<T>>, index: number): ReadonlyArray<ReadonlyArray<T>> => [
    ...batches.slice(0, index),
    ...halvesOf(batches[index] ?? []),
    ...batches.slice(index + 1),
]

/** What one model call is asked with. */
export interface Ask {
    /** The standing instructions. */
    readonly system: string
    /** The turns after them: the passages of the call, and for a follow-up its own answer and what was wrong with it. */
    readonly turns: ReadonlyArray<AiMessage>
    /** What the call may spend. */
    readonly budget: AiBudget
    /** The workspace charged, and the owner of the cache affinity. */
    readonly workspaceId: string
    /** The try of the window this call is (a follow-up is the second). */
    readonly tryNumber: number
    /** The JSON Schema of the answer, sent as the API's structured output where the route has it (TRIAGE-5); absent: free text. */
    readonly outputSchema?: Readonly<Record<string, unknown>>
}

/** What a stage carries from one call to the next. */
export interface Run {
    /** The document. */
    readonly source: SourceRecord
    /** The stage. */
    readonly stage: ExtractionStage
    /** The batches of the stage, in order (a batch split in two becomes two batches). */
    readonly batches: ReadonlyArray<ReadonlyArray<TruthPassage>>
    /** The counts the stage shows, fixed for the stage. */
    readonly counts: Partial<TruthCounts>
    /** Reading calls done before this job (the extract stage; null for triage, which shows the calls done). */
    readonly before: number | null
    /** Passages judged before the stage's model calls (the triage stage counts up from here). */
    readonly judged: number
    /**
     * The lines of the whole document in order (every passage, as written): what the call that reads the
     * document's own date is shown (the extract stage; absent for triage).
     */
    readonly documentLines?: ReadonlyArray<string>
}

/** Where a stage stands between two calls. */
export interface Step {
    /** The batch to work next. */
    readonly index: number
    /** Model calls made by this job in this stage. */
    readonly calls: number
    /** Where the reading stands. */
    readonly state: Reading
    /** The verdicts written so far, by passage id (the triage stage). */
    readonly verdicts: ReadonlyMap<string, TriageVerdict>
    /** The passages read or skipped so far (the extract stage). */
    readonly read: ReadonlySet<string>
    /**
     * The date the document states as its own, once this job asked for it (at most one call per job, and only when a line gave a period
     * relative to it); absent while it was not asked.
     */
    readonly documentDate?: DocumentDate
}

/** What filing one call did. */
export interface CallFiled {
    /** How many truths were filed (new rows and evidence added to known ones). */
    readonly filed: number
    /** The new rows. */
    readonly facts: ReadonlyArray<FactRecord>
    /** The truths the store refused to file (counted as refused lines, never silent). */
    readonly failed: ReadonlyArray<ExtractedFact>
}

/** What reading one window gave: its answer read line by line, or why nothing could be read. */
export interface WindowRead {
    /** The answer read, or null when no answer could be read. */
    readonly parsed: ParsedFacts | null
    /** The last answer the model gave, or null. */
    readonly answer: AiChatAnswer | null
    /** Model calls made for the window (1, or 2 with a follow-up). */
    readonly calls: number
    /** Why the window is skipped, or null when it is read. */
    readonly skipped: AnswerNoteReason | null
    /** Every raw answer the window got, in order (kept in the reading's notes when it is skipped, never logged). */
    readonly raw: ReadonlyArray<string>
}

/**
 * Why a window's answer is asked once more, or null when it is taken as it is. The window's ONE follow-up (never a second: the bound of
 * D-N-10) names every fault the answer has, whatever reason comes first here (`followUpOf`): no line readable or every line ungrounded,
 * then labels in another language, then truth lines refused for a reason the model can mend (`faults`), then lines of rule material
 * neither read nor skipped, or skipped as unclear (TRIAGE-3, D-T-5): silence is never an answer.
 */
export const followUpFor = (parsed: ParsedFacts): FollowUp | null => {
    if (!parsed.valid || (parsed.facts.length === 0 && parsed.ungrounded > 0)) return "format"
    if (parsed.foreign > 0) return "language"
    if (parsed.faults.length > 0) return "refused"
    return parsed.unaccounted.length > 0 ? "unaccounted" : null
}

/** The lines an answer loses: its refused truth lines and the lines of rule material it does not account for. */
const lostOf = (parsed: ParsedFacts): number => parsed.faults.length + parsed.unaccounted.length

/** Whether a follow-up's answer reads better than the first one for the reason it was asked (it is taken whole, never mixed with the first). */
export const readsBetter = (again: ParsedFacts, first: ParsedFacts, why: FollowUp): boolean => {
    if (why === "language") return again.facts.length >= first.facts.length && again.foreign < first.foreign
    if (why === "refused" || why === "unaccounted") return again.facts.length >= first.facts.length && lostOf(again) < lostOf(first)
    return !first.valid || again.facts.length > first.facts.length
}

/** The longest label a truth's document evidence carries (the title, and the basis of a period not as written). */
const EVIDENCE_LABEL_MAX = 400

/**
 * The evidence a truth carries about the document it was read from: the words and the hash of its passage. A period computed from the
 * document's own date, or left out because it could not be read or computed (`period_unclear`: what was written and why), says so in
 * the label (`periodNote`): the founder sees the basis beside the source. It
 * stays ONE document item (no separate note item: a note would outlive the document's withdrawal and keep the truth standing).
 */
export const documentEvidenceOf = (source: SourceRecord, fact: ExtractedFact): Evidence => ({
    kind: "document",
    ref: source.id,
    label: fact.periodNote === undefined ? source.title : `${source.title} · ${fact.periodNote}`.slice(0, EVIDENCE_LABEL_MAX),
    quote: fact.quote,
    at: source.updatedAt,
    sourceId: source.id,
    title: source.title,
    chunkHash: fact.passage.hash,
})

/** How a stage ended, before its passages are put back together. */
export interface Ended {
    /** How it ended. */
    readonly end: StageEnd
    /** Where the reading stands. */
    readonly state: Reading
    /** Batches left for a follow-up job. */
    readonly left: number
    /** Where the stage stood when it ended. */
    readonly step: Step
}
