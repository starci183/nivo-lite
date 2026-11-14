/** Where a gap stands: open, answered by a fact or document, or dismissed by the owner. */
export type GapStatus = "open" | "answered" | "dismissed"

/** A question customers asked that the brain could not answer; one record stands for every similar question. */
export interface GapRecord {
    /** The gap id. */
    readonly id: string
    /** The customer-facing agent that could not answer. */
    readonly module: string
    /** The question as first asked. */
    readonly question: string
    /** The subject guess. */
    readonly topic: string | null
    /** The attribute guess. */
    readonly attributeGuess: string | null
    /** How many times it was asked. */
    readonly count: number
    /** When it was first asked. */
    readonly firstSeenAt: string
    /** When it was last asked. */
    readonly lastSeenAt: string
    /** One conversation that asked it. */
    readonly exampleConversationId: string | null
    /** Where it stands. */
    readonly status: GapStatus
    /** How many times it was asked again after being answered. */
    readonly reopenedCount: number
}

/** A question a customer asked that nothing answered. */
export interface GapInput {
    /** The agent that was asked. */
    readonly module: string
    /** The question as written. */
    readonly question: string
    /** "subject | attribute" the answer would be filed under, when the model gave one. */
    readonly topic?: string | null
    /** The conversation the question came from. */
    readonly conversationId?: string | null
    /** Who noticed: the reply itself (model) or a search that found nothing (retrieval). */
    readonly source: "model" | "retrieval"
}

/** What recording a question did. */
export interface GapRecorded {
    /** The gap as stored. */
    readonly gap: GapRecord
    /** A new gap was started. */
    readonly isNew: boolean
    /** An answered gap was asked again and is open once more. */
    readonly reopened: boolean
}

/**
 * The truth that answers: its two labels, as written by whoever stated it. An open gap is answered by it when the topic and the
 * attribute a MODEL wrote for the gap (the agent's own turn, `GapInput.topic`) are the same keys (`factSlugOf`, exact). No word of
 * the question or of the answer is compared.
 */
export interface Answerer {
    /** The subject label of the truth. */
    readonly subject: string
    /** Its attribute label. */
    readonly attribute: string
    /** The agent it is for; null = every agent. */
    readonly module: string | null
    /** The `answered_by` stamp. */
    readonly by: string
}

/** What recording a question did, or null when the question has no letter or digit to remember it by. */
export type MaybeGapRecorded = GapRecorded | null

/** The open gaps of one agent and how many there are. */
export interface ModuleGaps {
    /** How many gaps of the agent are open. */
    readonly openCount: number
    /** The most asked few. */
    readonly items: ReadonlyArray<GapRecord>
}
