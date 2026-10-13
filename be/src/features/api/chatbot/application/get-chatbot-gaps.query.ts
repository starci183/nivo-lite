import { Query } from "@nestjs/cqrs"
import type { ChatbotGaps } from "@modules/domain/chatbot-workbench"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetChatbotGapsRequest } from "./get-chatbot-gaps.contracts"

/** Asks for the authorized Chatbot gaps. */
export class GetChatbotGapsQuery extends Query<ChatbotGaps> {
    constructor(readonly params: ExecuteParams<GetChatbotGapsRequest>) {
        super()
    }
}
