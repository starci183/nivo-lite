import { QueryHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import type { AgentChatConversations } from "@modules/domain/agent-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListAgentChatConversationsQuery } from "./agent-chat-conversations.query"

@QueryHandler(ListAgentChatConversationsQuery)
/** Dispatches agentChatConversations to the membership-proving chat service. */
export class ListAgentChatConversationsHandler extends ICQRSHandler<
    ListAgentChatConversationsQuery,
    AgentChatConversations
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(query: ListAgentChatConversationsQuery): Promise<AgentChatConversations> {
        return this.chat.listConversations(query.params.principal.id, query.params.request)
    }
}
