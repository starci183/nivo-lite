import { Command } from "@nestjs/cqrs"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestChatAnswerRequest } from "./request-chat-answer.contracts"

/** Queues the decision of a waiting customer escalation. */
export class RequestChatAnswerCommand extends Command<ChatReplyProgress> {
    constructor(readonly params: ExecuteParams<RequestChatAnswerRequest>) {
        super()
    }
}
