import type { AgentChatTurnStatusRequest, AgentChatTurnStatus } from "@modules/domain/agent-chat"
import type { AgentChatTurnStatusInput } from "./dto/agent-chat-turn-status.input"
import type { AgentChatTurnStatusType } from "./dto/agent-chat-turn-status.type"

/** Maps the GraphQL input and workspace selector to the request. */
export const toGetAgentChatTurnStatusRequest = (
    workspaceId: string,
    input: AgentChatTurnStatusInput,
): AgentChatTurnStatusRequest => ({ workspaceId, id: input.id })

/** Maps the application result to the GraphQL contract. */
export const toGetAgentChatTurnStatusType = (result: AgentChatTurnStatus): AgentChatTurnStatusType => ({ ...result })
