import { QueryHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import type { AgentChatMessages } from "@modules/domain/agent-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListAgentChatMessagesQuery } from "./agent-chat-messages.query"

@QueryHandler(ListAgentChatMessagesQuery)
/** Dispatches agentChatMessages to the membership-proving chat service. */
export class ListAgentChatMessagesHandler extends ICQRSHandler<ListAgentChatMessagesQuery, AgentChatMessages> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(query: ListAgentChatMessagesQuery): Promise<AgentChatMessages> {
        return this.chat.listMessages(query.params.principal.id, query.params.request)
    }
}
