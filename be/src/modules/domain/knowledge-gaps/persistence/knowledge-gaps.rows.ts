import type { GapStatus } from "../knowledge-gaps.contracts"

/** One row of public.knowledge_gaps; timestamps arrive as Date or text depending on the driver. */
export interface KnowledgeGapRow {
    /** The gap id. */
    readonly id: string
    /** The agent that could not answer. */
    readonly module: string
    /** The question as first asked. */
    readonly question: string
    /** The normalised question. */
    readonly question_key: string
    /** The significant words. */
    readonly keywords: ReadonlyArray<string> | null
    /** The subject guess. */
    readonly topic: string | null
    /** The attribute guess. */
    readonly attribute_guess: string | null
    /** How many times it was asked. */
    readonly count: number
    /** First asked. */
    readonly first_seen_at: Date | string
    /** Last asked. */
    readonly last_seen_at: Date | string
    /** One conversation that asked it. */
    readonly example_conversation_id: string | null
    /** open, answered or dismissed. */
    readonly status: GapStatus
    /** Times asked again after an answer. */
    readonly reopened_count: number
}

/** The count of open gaps. */
export interface OpenCountRow {
    /** How many. */
    readonly total: number
}
