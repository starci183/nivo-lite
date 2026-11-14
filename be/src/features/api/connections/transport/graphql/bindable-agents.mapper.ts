import type { BindableAgent } from "@modules/domain/connection-grants"
import type { BindableAgentsRequest } from "../../application/bindable-agents.contracts"
import type { BindableAgentType } from "./dto/bindable-agent.type"
import type { BindableAgentsInput } from "./dto/bindable-agents.input"

/** Maps the GraphQL arguments of bindableAgents to the request. */
export const toBindableAgentsRequest = (workspaceId: string, input: BindableAgentsInput): BindableAgentsRequest => ({
    workspaceId,
    provider: input.provider,
})

/** Maps the answer of bindableAgents to the GraphQL type. */
export const toBindableAgentsType = (result: ReadonlyArray<BindableAgent>): Array<BindableAgentType> =>
    result.map((agent) => ({ ...agent }))
