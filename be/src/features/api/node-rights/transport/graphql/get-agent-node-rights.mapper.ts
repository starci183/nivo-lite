import type { AgentNodeRights } from "@modules/domain/node-right-rollups"
import type { GetAgentNodeRightsRequest } from "../../application/get-agent-node-rights.contracts"
import type { GetAgentNodeRightsInput } from "./dto/get-agent-node-rights.input"
import type { AgentNodeRightsType } from "./dto/get-agent-node-rights.type"

/** Maps the GraphQL arguments of agentNodeRights to the request. */
export const toGetAgentNodeRightsRequest = (
    workspaceId: string,
    input: GetAgentNodeRightsInput,
): GetAgentNodeRightsRequest => ({
    workspaceId,
    agentId: input.agentId,
})

/** Maps the answer of agentNodeRights to the GraphQL type: the capability already answers in its shape. */
export const toAgentNodeRightsType = (answer: AgentNodeRights): AgentNodeRightsType => answer
