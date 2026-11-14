/** A text in both product languages. */
export interface AgentToolText {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/**
 * Where a tool of the agent comes from: `declared` by its module's agent (the hard set a step may ever use), `attached` given by an
 * account the agent is attached to (a provider tool the account's provider serves), `default-read` a context read every agent holds unless the owner
 * forbids it.
 */
export type AgentToolOrigin = "declared" | "attached" | "default-read"

/** One attached account through which the agent may call a provider tool (which one a call uses is the step's choice; its mode is the step's). */
export interface AgentToolAccount {
    /** The connection. */
    readonly connectionId: string
    /** Its provider. */
    readonly provider: string
    /** The account as people read it ("Tiem hoa NIVO", "MB Bank **** 5252"). */
    readonly accountLabel: string
}

/** One tool the agent can call, in the shop's words. */
export interface AgentToolLine {
    /** The tool id. */
    readonly id: string
    /** Its name. */
    readonly title: AgentToolText
    /** What it lets the agent do, one line. */
    readonly summary: AgentToolText
    /** `acts` (changes something or says something) or `reads`. */
    readonly kind: "acts" | "reads"
    /** Where it comes from. */
    readonly origin: AgentToolOrigin
    /** The owner's grant row when it restricts the tool (`ask` or `never`); null when no row restricts it. */
    readonly grant: "ask" | "never" | null
    /** For a provider tool, the attached accounts of a provider that serves it; empty for any other tool. */
    readonly accounts: ReadonlyArray<AgentToolAccount>
    /** False when the agent cannot call it now: forbidden by a grant row, or a provider tool no attached account serves. */
    readonly ready: boolean
}
