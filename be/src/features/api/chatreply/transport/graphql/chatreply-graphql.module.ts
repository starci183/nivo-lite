import { Module } from "@nestjs/common"
import { ChatReplyApiModule } from "../../chatreply.module"
import { ConfigurableModuleClass } from "./chatreply-graphql.module-definition"
import { RequestChatAnswerResolver } from "./request-chat-answer.resolver"
import { SetChatHandlingResolver } from "./set-chat-handling.resolver"
import { RequestChatReplyResolver } from "./request-chat-reply.resolver"
import { ChatAnswerStatusResolver } from "./chat-answer-status.resolver"
import { ChatReplyStatusResolver } from "./chat-reply-status.resolver"

@Module({
    imports: [ChatReplyApiModule.register({})],
    providers: [
        RequestChatAnswerResolver,
        SetChatHandlingResolver,
        RequestChatReplyResolver,
        ChatAnswerStatusResolver,
        ChatReplyStatusResolver,
    ],
})
/** The GraphQL doors over customer reply application handlers. */
export class ChatReplyGraphqlModule extends ConfigurableModuleClass {}
