import { Module } from "@nestjs/common"
import { ChatTypingChannelHandler } from "./application/chat-typing-channel.handler"
import { SetChatTypingHandler } from "./application/set-chat-typing.handler"
import { ConfigurableModuleClass } from "./chattyping.module-definition"

@Module({ providers: [ChatTypingChannelHandler, SetChatTypingHandler] })
/** The typing channel and write command handlers. */
export class ChattypingApiModule extends ConfigurableModuleClass {}
