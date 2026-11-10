/** What reading the tool set of one agent takes. */
export interface GetAgentToolsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves the owner or manager role. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
}

/** A text in both product languages. */
export interface AgentToolText {
    /** Vietnamese. */
    readonly vi: string
    /** English. */
    readonly en: string
}

/**
 * Where a tool of the agent comes from: `declared` by its module's agent (the hard set a step may ever use), `ability` given by an
 * ability ticked on a connected account the agent is attached to, `default-read` a context read every agent holds unless the owner
 * forbids it.
 */
export type AgentToolOrigin = "declared" | "ability" | "default-read"

/** One connected account through which the agent may call a provider tool, and how. */
export interface AgentToolAccount {
    /** The connection. */
    readonly connectionId: string
    /** Its provider. */
    readonly provider: string
    /** The account as people read it ("Tiệm hoa NIVO", "MB Bank •••• 5252"). */
    readonly accountLabel: string
    /** The ability ticked on it that holds the tool. */
    readonly ability: string
    /** `auto` runs by itself, `ask` waits for a person each time. */
    readonly mode: "auto" | "ask"
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
    /** For a provider tool, the attached accounts whose ticked ability holds it; empty for any other tool. */
    readonly accounts: ReadonlyArray<AgentToolAccount>
    /** False when the agent cannot call it now: forbidden by a grant row, or a provider tool no attached account ticks. */
    readonly ready: boolean
}
