import { Query } from "@nestjs/cqrs"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChatAnswerStatusRequest } from "./chat-answer-status.contracts"

/** Reads the queued escalation decision and its answer delivery. */
export class ChatAnswerStatusQuery extends Query<ChatReplyProgress> {
    constructor(readonly params: ExecuteParams<ChatAnswerStatusRequest>) {
        super()
    }
}
