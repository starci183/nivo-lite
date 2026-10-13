import { Module } from "@nestjs/common"
import { RequestChatAnswerHandler } from "./application/request-chat-answer.handler"
import { SetChatHandlingHandler } from "./application/set-chat-handling.handler"
import { RequestChatReplyHandler } from "./application/request-chat-reply.handler"
import { ChatAnswerStatusHandler } from "./application/chat-answer-status.handler"
import { ChatReplyStatusHandler } from "./application/chat-reply-status.handler"

@Module({
    providers: [
        RequestChatAnswerHandler,
        SetChatHandlingHandler,
        RequestChatReplyHandler,
        ChatAnswerStatusHandler,
        ChatReplyStatusHandler,
    ],
})
/** The application handlers for member customer replies and their queued progress. */
export class ChatReplyApiModule {}
