import { Query } from "@nestjs/cqrs"
import type { AgentChatAgentRequest, AgentChatConversations } from "@modules/domain/agent-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Requests agentChatConversations in the caller's selected workspace. */
export class ListAgentChatConversationsQuery extends Query<AgentChatConversations> {
    constructor(readonly params: ExecuteParams<AgentChatAgentRequest>) {
        super()
    }
}
