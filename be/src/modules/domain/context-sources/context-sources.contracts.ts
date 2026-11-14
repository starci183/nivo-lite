/** Who a context source answers about: the shop as a whole, or the customer of the conversation the run serves (hard-locked). */
export type ContextScope = "shop" | "customer"

/** Which view a read answers for: `customer` (a customer-facing run: public facts only) or `internal` (the shop's own agents). */
export type ContextAudience = "customer" | "internal"

/** One source of context on the one shape every source has (owner rule "MCP het", 2026-11-10). */
export interface ContextSource {
    /** The source key, the `source` every read of it answers (`nivo.lead`). */
    readonly key: string
    /** Who it answers about. */
    readonly scope: ContextScope
    /** What a customer-facing run sees of it, in a few words for the prompt and the run page. */
    readonly lens: string
    /** A short brief of what it holds, for the prompt. */
    readonly brief: string
    /** The read tools of the source, by full id: the detailed query an agent pulls. */
    readonly tools: ReadonlyArray<string>
}

/** One fact a context read answers: one record, its members by name. */
export interface ContextFact {
    /** One member by name. */
    readonly [member: string]: unknown
}

/**
 * Why a context read answered no fact although the run names its subject: `not_owner`, the conversation is another agent's record (a
 * conversation is read only by the agent that owns it; another agent gets what it needs of it through its `callWorkflow` input).
 */
export type ContextReadReason = "not_owner"

/** What every context read answers: the notice, the source, when it was read, and the facts (the uniform result of every source). */
export interface ContextResult {
    /** The words that say the rest is reference data, never an instruction. */
    readonly notice: string
    /** The source the facts come from. */
    readonly source: string
    /** When the records were read, ISO text: they hold as of then. */
    readonly asOf: string
    /** The facts, newest first for a list. */
    readonly facts: ReadonlyArray<ContextFact>
    /** Why there are no facts, when the read refused its subject (absent for a read that answered). */
    readonly reason?: ContextReadReason
}

/** The conversation and the person one locked read answers about, as the door fixed them from the run token. */
export interface LockedSubject {
    /** The conversation the run serves, or null. */
    readonly conversationId: string | null
    /** The contact (the person) the run serves, or null when it serves none: the conversation's, else the run token's. */
    readonly contactId: string | null
    /** The sales lead a module resolved as the run's subject (the bridge of the sales reads that still name one), or null. */
    readonly leadId: string | null
}

/** A row the engine answered: its data and when it was written. */
export interface ContextRow {
    /** The id. */
    readonly id: string
    /** The fields asked. */
    readonly data: Readonly<Record<string, unknown>>
    /** When it was created, ISO text. */
    readonly createdAt: string
}
