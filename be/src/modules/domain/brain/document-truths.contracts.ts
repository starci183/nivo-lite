import type { ExtractionStatus } from "@modules/domain/brain-extractions"
import type { TruthPassage } from "@modules/domain/knowledge-chunks"
import type { SourceRecord } from "@modules/domain/knowledge-sources"

/** Where the truths work of a document stands inside one job. */
export interface Reading {
    /** The fingerprint of the text being read (keys the follow-up job). */
    readonly hash: string
    /** Truth-reading calls made over the whole reading. */
    readonly done: number
    /** Truths filed over the whole reading. */
    readonly filed: number
    /** Tries that failed in a row. */
    readonly attempts: number
    /** Active truths waiting for the new reading to confirm them. */
    readonly orphans: ReadonlyArray<string>
    /** The model that answered the last call. */
    readonly model: string
}

/**
 * How a stage of the truths work ended in this job:
 * - `done`: every passage of the stage is worked; the next stage follows;
 * - `budget`: the job made its calls; a follow-up job goes on (`left` batches are left);
 * - `blocked`: the credit pool is empty; the reading waits;
 * - `retry`: a call gave nothing usable; the queue runs the job again;
 * - `gave_up`: three tries in a row failed; the reading is given up.
 */
export type StageEnd = "done" | "budget" | "blocked" | "retry" | "gave_up"

/** What a stage hands back: how it ended, the passages as they stand now, and where the reading stands. */
export interface StageResult {
    /** How the stage ended. */
    readonly end: StageEnd
    /** The passages of the document with the verdicts and readings this stage wrote. */
    readonly passages: ReadonlyArray<TruthPassage>
    /** Where the reading stands after the stage. */
    readonly state: Reading
    /** Batches left for a follow-up job (only with `budget`). */
    readonly left: number
}

/** What one stage works on. */
export interface StageInput {
    /** The document. */
    readonly source: SourceRecord
    /** Its passages as they stand. */
    readonly passages: ReadonlyArray<TruthPassage>
    /** Where the reading stands. */
    readonly state: Reading
}

/** The state a settle leaves a reading waiting in, with its stored code. */
export interface Parked {
    /** What it waits for. */
    readonly status: ExtractionStatus
    /** The stored code the documents page words. */
    readonly note: string
}

/** A settle that leaves the reading waiting, or null when it is finished. */
export type MaybeParked = Parked | null

/** How many truths a settle left in each state. */
export interface SettleTally {
    /** Put in force. */
    readonly applied: number
    /** The founder is asked. */
    readonly asked: number
    /** Wait for a person (no member of the workspace stands behind the document). */
    readonly waiting: number
    /** Wait for room under the ceiling. */
    readonly full: number
}

/** The stored code of a reading that stopped at the ceiling of truths in force. */
export const NOTE_AT_CEILING = "BRAIN_NOTE_TRUTH_CEILING"

/** A list cut into runs of `size`. */
export const batchesOf = <T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size))

/**
 * The state a settle leaves the reading waiting in, or null when it is finished: only the ceiling parks a settle (a document's truths
 * never wait for another document, another part or the critic, owner 2026-11-12).
 */
export const parkedOf = (tally: SettleTally): MaybeParked =>
    tally.full > 0 ? { status: "at_ceiling", note: NOTE_AT_CEILING } : null
