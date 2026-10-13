import type { SetConnectionAgentsRequest } from "../../application/set-connection-agents.contracts"
import type { SetConnectionAgentsInput } from "./dto/set-connection-agents.input"

/** Maps the GraphQL arguments of setConnectionAgents to the request. */
export const toSetConnectionAgentsRequest = (
    workspaceId: string,
    input: SetConnectionAgentsInput,
): SetConnectionAgentsRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    agents: input.agents.map((wish) => ({ agentId: wish.agentId, access: wish.access })),
})
