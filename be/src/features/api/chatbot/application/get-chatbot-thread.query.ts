import { Query } from "@nestjs/cqrs"
import type { ChatbotThread } from "@modules/domain/chatbot-workbench"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetChatbotThreadRequest } from "./get-chatbot-thread.contracts"

/** Asks for the authorized Chatbot thread. */
export class GetChatbotThreadQuery extends Query<ChatbotThread> {
    constructor(readonly params: ExecuteParams<GetChatbotThreadRequest>) {
        super()
    }
}
