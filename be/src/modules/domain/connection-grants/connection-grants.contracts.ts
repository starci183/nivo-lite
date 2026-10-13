import type { ConnectionRecord } from "@modules/domain/connections"
import type { Access } from "./connection-access.policy"

/** One agent wanted on a connection; without a level it keeps its current one (or starts at ask). */
export interface AgentGrantWish {
    /** The agent. */
    readonly agentId: string
    /** The level, when the caller picks one. */
    readonly access?: Access | undefined
}

/** One connection wanted for an agent; without a level it keeps its current one (or starts at ask). */
export interface ConnectionGrantWish {
    /** The connection. */
    readonly connectionId: string
    /** The level, when the caller picks one. */
    readonly access?: Access | undefined
}

/** One agent access to a connection, as the console lists it. */
export interface ConnectionGrantEntry {
    /** The agent. */
    readonly agentId: string
    /** The level of access. */
    readonly access: Access
}

/** One connection of the workspace with the access of each agent that uses it. */
export interface ConnectionBoardEntry {
    /** The connection, without any secret. */
    readonly connection: ConnectionRecord
    /** The agents that use it, in the order they were attached. */
    readonly grants: ReadonlyArray<ConnectionGrantEntry>
}
