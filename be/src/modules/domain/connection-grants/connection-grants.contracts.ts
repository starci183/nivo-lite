import type { ConnectionRecord } from "@modules/domain/connections"

/** One agent wanted on a connection (bound to it). */
export interface AgentGrantWish {
    /** The agent. */
    readonly agentId: string
}

/** One connection wanted for an agent (the agent bound to it). */
export interface ConnectionGrantWish {
    /** The connection. */
    readonly connectionId: string
}

/** One agent bound to a connection, as the console lists it. */
export interface ConnectionGrantEntry {
    /** The agent. */
    readonly agentId: string
}

/** One connection an agent is allowed to use, and whether it is bound to it already. */
export interface ConnectionCandidate {
    /** The connection. */
    readonly id: string
    /** The display name. */
    readonly name: string
    /** The provider it connects to. */
    readonly provider: string
    /** The bot username, when the provider has one. */
    readonly botUsername: string | null
    /** The masked bank account, when the connection is a bank feed. */
    readonly accountMasked: string | null
    /** Where the connection is in its life. */
    readonly status: string
    /** What this agent would use it for. */
    readonly purpose: string
    /** Whether the agent is already bound to it. */
    readonly bound: boolean
}

/** One connection of the workspace with the agents bound to it. */
export interface ConnectionBoardEntry {
    /** The connection, without any secret. */
    readonly connection: ConnectionRecord
    /** The bot username, when the provider has one. */
    readonly botUsername: string | null
    /** The masked bank account, when the connection is a bank feed. */
    readonly accountMasked: string | null
    /** The agents that use it, in the order they were attached. */
    readonly grants: ReadonlyArray<ConnectionGrantEntry>
}

/** One active agent of the workspace that may be bound to a connection of a provider, and what it would do there. */
export interface BindableAgent {
    /** The agent. */
    readonly agentId: string
    /** What the agent would use the connection for. */
    readonly purpose: string
}
