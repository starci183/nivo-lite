import type { AgentGrantWish } from "@modules/domain/connection-grants"

/** What setConnectionAgents takes. */
export interface SetConnectionAgentsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The agents wanted. */
    readonly agents: ReadonlyArray<AgentGrantWish>
}
