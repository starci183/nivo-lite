import type { SetAgentConnectionsRequest } from "../../application/set-agent-connections.contracts"
import type { SetAgentConnectionsInput } from "./dto/set-agent-connections.input"

/** Maps the GraphQL arguments of setAgentConnections to the request. */
export const toSetAgentConnectionsRequest = (
    workspaceId: string,
    input: SetAgentConnectionsInput,
): SetAgentConnectionsRequest => ({
    workspaceId,
    agentId: input.agentId,
    connections: input.connections.map((wish) => ({ connectionId: wish.connectionId, access: wish.access })),
})
