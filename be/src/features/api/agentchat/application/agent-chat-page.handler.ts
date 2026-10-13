import { QueryHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import type { AgentChatPageData } from "@modules/domain/agent-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentChatPageQuery } from "./agent-chat-page.query"

@QueryHandler(GetAgentChatPageQuery)
/** Dispatches agentChatPage to the membership-proving chat service. */
export class GetAgentChatPageHandler extends ICQRSHandler<GetAgentChatPageQuery, AgentChatPageData> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(query: GetAgentChatPageQuery): Promise<AgentChatPageData> {
        return this.chat.page(query.params.principal.id, query.params.request)
    }
}
