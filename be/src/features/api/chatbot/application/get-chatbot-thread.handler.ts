import { QueryHandler } from "@nestjs/cqrs"
import { ChatbotWorkbenchService } from "@modules/domain/chatbot-workbench"
import type { ChatbotThread } from "@modules/domain/chatbot-workbench"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetChatbotThreadQuery } from "./get-chatbot-thread.query"

@QueryHandler(GetChatbotThreadQuery)
/** Answers the thread after the domain service proves the caller's workspace access. */
export class GetChatbotThreadHandler extends ICQRSHandler<GetChatbotThreadQuery, ChatbotThread> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly workbench: ChatbotWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(query: GetChatbotThreadQuery): Promise<ChatbotThread> {
        return this.workbench.thread(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.conversationId,
        )
    }
}
