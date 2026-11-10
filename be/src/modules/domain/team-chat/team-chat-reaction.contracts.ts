/** One emoji on a message, summed over the members, for one viewer. */
export interface ReactionView {
    /** The emoji. */
    readonly emoji: string
    /** How many times everyone tapped it. */
    readonly count: number
    /** Whether the viewer tapped it. */
    readonly mine: boolean
    /** How many times the viewer tapped it; 0 when they did not. */
    readonly mineCount: number
}

/** The message a reply quotes, as a screen draws the quote. */
export interface ReplyView {
    /** The quoted message. */
    readonly messageId: string
    /** The name of its author; empty for a system line or a member who left. */
    readonly authorName: string
    /** The first words of it, on one line. */
    readonly body: string
}

/** One row of the reaction table: how many times one member tapped one emoji on one message. */
export interface ReactionRow {
    /** The message. */
    readonly messageId: string
    /** Whether the member is a person or an agent. */
    readonly memberKind: "user" | "agent"
    /** The account or the agent. */
    readonly memberId: string
    /** The emoji. */
    readonly emoji: string
    /** How many times the member tapped it. */
    readonly count: number
}

/** What a member already tapped, or none. */
export type OptionalHeld = ReactionHeld | null

/** What one member already tapped of one emoji on one message, and how long ago the last tap was by the database clock. */
export interface ReactionHeld {
    /** How many times the member tapped it so far. */
    readonly count: number
    /** Milliseconds since the last tap. */
    readonly idleMs: number
}
