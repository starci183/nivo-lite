import { Query } from "@nestjs/cqrs"
import type { ChatbotOverview } from "@modules/domain/chatbot-workbench"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetChatbotOverviewRequest } from "./get-chatbot-overview.contracts"

/** Asks for the authorized Chatbot overview. */
export class GetChatbotOverviewQuery extends Query<ChatbotOverview> {
    constructor(readonly params: ExecuteParams<GetChatbotOverviewRequest>) {
        super()
    }
}
