import type { Access } from "./connection-access.policy"

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
