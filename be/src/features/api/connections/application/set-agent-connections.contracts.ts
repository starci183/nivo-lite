import type { ConnectionGrantWish } from "@modules/domain/connection-grants"

/** What setAgentConnections takes. */
export interface SetAgentConnectionsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connections wanted. */
    readonly connections: ReadonlyArray<ConnectionGrantWish>
}
