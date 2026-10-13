import { QueryHandler } from "@nestjs/cqrs"
import { ChatbotWorkbenchService } from "@modules/domain/chatbot-workbench"
import type { ChatbotOverview } from "@modules/domain/chatbot-workbench"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetChatbotOverviewQuery } from "./get-chatbot-overview.query"

@QueryHandler(GetChatbotOverviewQuery)
/** Answers the overview after the domain service proves the caller's workspace access. */
export class GetChatbotOverviewHandler extends ICQRSHandler<GetChatbotOverviewQuery, ChatbotOverview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: ChatbotWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: GetChatbotOverviewQuery): Promise<ChatbotOverview> {
        return this.workbench.overview(query.params.principal.id, query.params.request)
    }
}
