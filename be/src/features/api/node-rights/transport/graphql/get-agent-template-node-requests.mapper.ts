import type { TemplateNodeRequests } from "@modules/domain/node-right-rollups"
import type { GetAgentTemplateNodeRequestsRequest } from "../../application/get-agent-template-node-requests.contracts"
import type { GetAgentTemplateNodeRequestsInput } from "./dto/get-agent-template-node-requests.input"
import type { AgentTemplateNodeRequestsType } from "./dto/get-agent-template-node-requests.type"

/** Maps the GraphQL arguments of agentTemplateNodeRequests to the request. */
export const toGetAgentTemplateNodeRequestsRequest = (
    workspaceId: string,
    input: GetAgentTemplateNodeRequestsInput,
): GetAgentTemplateNodeRequestsRequest => ({ workspaceId, templateId: input.templateId, version: input.version })

/** Maps the answer of agentTemplateNodeRequests to the GraphQL type: the capability already answers in its shape. */
export const toAgentTemplateNodeRequestsType = (answer: TemplateNodeRequests): AgentTemplateNodeRequestsType => answer
