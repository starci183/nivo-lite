import { QueryHandler } from "@nestjs/cqrs"
import { ChatbotWorkbenchService } from "@modules/domain/chatbot-workbench"
import type { ChatbotGaps } from "@modules/domain/chatbot-workbench"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetChatbotGapsQuery } from "./get-chatbot-gaps.query"

@QueryHandler(GetChatbotGapsQuery)
/** Answers the gaps after the domain service proves the caller's workspace access. */
export class GetChatbotGapsHandler extends ICQRSHandler<GetChatbotGapsQuery, ChatbotGaps> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: ChatbotWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: GetChatbotGapsQuery): Promise<ChatbotGaps> {
        return this.workbench.gaps(query.params.principal.id, query.params.request.workspaceId)
    }
}
