import type { AgentToolLine } from "@modules/domain/agent-pages"
import type { GetAgentToolsRequest } from "../../application/get-agent-tools.contracts"
import type { AgentIdInput } from "./dto/agent-id.input"
import type { AgentToolType } from "./dto/agent-tool.type"

/** Maps the agent of the GraphQL input, with the workspace it names, to the tool set request. */
export const toGetAgentToolsRequest = (workspaceId: string, input: AgentIdInput): GetAgentToolsRequest => ({
    workspaceId,
    agentId: input.agentId,
})

/** Maps the agent's tools to the GraphQL type. */
export const toAgentToolsType = (tools: ReadonlyArray<AgentToolLine>): Array<AgentToolType> =>
    tools.map((tool) => ({
        ...tool,
        title: { ...tool.title },
        summary: { ...tool.summary },
        accounts: tool.accounts.map((account) => ({ ...account })),
    }))
