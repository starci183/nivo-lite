import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./chat-typing-sse.module-definition"
import { ChatTypingController } from "./chat-typing.controller"

@Module({ controllers: [ChatTypingController] })
/** The server-sent-events transport of the chat-typing channel: one authenticated stream per recipient and target. */
export class ChatTypingSseModule extends ConfigurableModuleClass {}
