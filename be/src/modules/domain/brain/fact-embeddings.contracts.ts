import type { FactEmbeddingState, FactRecord } from "@modules/domain/brain-facts"
import type { SameTruthVerdict } from "./same-fact.policy"

/** One fact of a window with its candidates and the judge's answer (null: not asked). */
export interface JudgedFact {
    /** The fact. */
    readonly fact: FactRecord
    /** Its candidates. */
    readonly candidates: ReadonlyArray<FactRecord>
    /** True when the vector index did not answer. */
    readonly indexDown: boolean
    /** The judgement, or null when none was asked. */
    readonly found: SameTruthVerdict | null
}

/** What one refresh did. */
export interface EmbeddingsRefreshed {
    /** Facts that got a (new) vector from the embedding call. */
    readonly embedded: number
    /** Facts that took the vector another row holds for the same line and identity: no embedding call. */
    readonly copied: number
    /** Facts whose vector was current: same text hash, same identity; nothing was sent for them. */
    readonly unchanged: number
}

/** What `embedLines` did, and whether an embedding call answered nothing (a sweep then stops: the next tick tries again). */
export interface LinesEmbedded extends EmbeddingsRefreshed {
    /** An embedding call failed or answered the wrong shape; the facts after it were not sent. */
    readonly stopped: boolean
}

/** One batch of lines to embed: each fact's state and the hash of its line. */
export interface LineBatchEntry {
    /** The fact with what its stored vector says. */
    readonly state: FactEmbeddingState
    /** The hash of its embedded line. */
    readonly hash: string
}

/** What one pass of the same-meaning check did. */
export interface SameMeaningChecked {
    /** Facts that had a candidate: one judgement each. */
    readonly judged: number
    /** Facts flagged `same_meaning` for the founder: the same truth with another value, or a verdict that stayed unknown. */
    readonly flagged: number
    /** Facts that were the same truth with the same value: closed as duplicates, their source joined that truth. */
    readonly merged?: number
    /** Facts whose verdict stayed unknown after every try (flagged with their nearest candidate). */
    readonly unsure?: number
    /**
     * Facts the vector index could not be asked about and that had no word candidate either: left as filed, not taken as distinct
     * truths, and logged (`SameMeaningIndexDown`).
     */
    readonly unchecked?: number
}

/** The truths one new truth is judged against, and whether the vector leg could not be asked. */
export interface Candidates {
    /** The candidates: nearest by vector first, then by words. */
    readonly facts: ReadonlyArray<FactRecord>
    /** True when the vector index did not answer: only word candidates are here. */
    readonly indexDown: boolean
}

/** What the judge's reading of same-key rewordings did (`FactEmbeddingsService.sameKeyRepeats`). */
export interface SameKeyRepeats {
    /** Pairs read by the judge. */
    readonly judged: number
    /** Of them, the truths closed as duplicates of the value they repeat. */
    readonly merged: number
}
