import type { ConnectionRecord } from "@modules/domain/connections"
import type { Access } from "@modules/domain/agent-connections"

/** One agent wanted on a connection; without a level it keeps its current one (or starts at ask). */
export interface AgentGrantWish {
    /** The agent. */
    readonly agentId: string
    /** The level, when the caller picks one. */
    readonly access?: Access
}

/** One connection wanted for an agent; without a level it keeps its current one (or starts at ask). */
export interface ConnectionGrantWish {
    /** The connection. */
    readonly connectionId: string
    /** The level, when the caller picks one. */
    readonly access?: Access
}

/** One agent access to a connection, as the console lists it. */
export interface ConnectionGrantEntry {
    /** The agent. */
    readonly agentId: string
    /** The level of access. */
    readonly access: Access
}

/** One connection an agent is allowed to use, with the access it already has. */
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
    /** The access the agent already has, or null when it has none yet. */
    readonly access: Access | null
}

/** One connection of the workspace with the access of each agent that uses it. */
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
