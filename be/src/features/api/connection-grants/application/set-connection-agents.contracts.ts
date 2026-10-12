import type { AgentGrantWish } from "@modules/domain/connection-grants"

/** What set connection agents takes. */
export interface SetConnectionAgentsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** Exactly these agents use the connection. */
    readonly agents: ReadonlyArray<AgentGrantWish>
}

/** What set connection agents answers: nothing. */
export type SetConnectionAgentsResult = void
