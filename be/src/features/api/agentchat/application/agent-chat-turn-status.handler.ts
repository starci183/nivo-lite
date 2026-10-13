import { QueryHandler } from "@nestjs/cqrs"
import { AgentChatService } from "@modules/domain/agent-chat"
import type { AgentChatTurnStatus } from "@modules/domain/agent-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentChatTurnStatusQuery } from "./agent-chat-turn-status.query"

@QueryHandler(GetAgentChatTurnStatusQuery)
/** Dispatches agentChatTurnStatus to the membership-proving chat service. */
export class GetAgentChatTurnStatusHandler extends ICQRSHandler<GetAgentChatTurnStatusQuery, AgentChatTurnStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: AgentChatService,
    ) {
        super(logger)
    }
    protected override process(query: GetAgentChatTurnStatusQuery): Promise<AgentChatTurnStatus> {
        return this.chat.turnStatus(query.params.principal.id, query.params.request)
    }
}
