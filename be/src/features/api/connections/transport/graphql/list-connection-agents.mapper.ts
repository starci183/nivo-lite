import type { ListConnectionAgentsRequest } from "../../application/list-connection-agents.contracts"
import type { AgentSummary } from "@modules/domain/agents"
import type { ConnectionAgentType } from "./dto/connection-agent.type"

/** Maps the GraphQL arguments of connectionAgents to the request. */
export const toListConnectionAgentsRequest = (workspaceId: string): ListConnectionAgentsRequest => ({
    workspaceId,
})

/** Maps the answer of connectionAgents to the GraphQL type. */
export const toListConnectionAgentsType = (result: ReadonlyArray<AgentSummary>): Array<ConnectionAgentType> => [
    ...result,
]
