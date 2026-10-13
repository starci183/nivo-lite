import { Command } from "@nestjs/cqrs"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestChatReplyRequest } from "./request-chat-reply.contracts"

/** Stores a member reply and queues its delivery. */
export class RequestChatReplyCommand extends Command<ChatReplyProgress> {
    constructor(readonly params: ExecuteParams<RequestChatReplyRequest>) {
        super()
    }
}
