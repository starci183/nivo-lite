import { Query } from "@nestjs/cqrs"
import type { AgentChatConversationRequest, AgentChatMessages } from "@modules/domain/agent-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests agentChatMessages in the caller's selected workspace. */
export class ListAgentChatMessagesQuery extends Query<AgentChatMessages> {
    constructor(readonly params: ExecuteParams<AgentChatConversationRequest>) {
        super()
    }
}
