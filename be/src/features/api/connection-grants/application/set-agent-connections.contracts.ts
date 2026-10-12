import type { ConnectionGrantWish } from "@modules/domain/connection-grants"

/** What set agent connections takes. */
export interface SetAgentConnectionsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** Exactly these connections are used by the agent. */
    readonly connections: ReadonlyArray<ConnectionGrantWish>
}

/** What set agent connections answers: nothing. */
export type SetAgentConnectionsResult = void
