import { Module } from "@nestjs/common"
import { SetChatTypingHandler } from "./application/set-chat-typing.handler"
import { ConfigurableModuleClass } from "./chattyping.module-definition"

@Module({ providers: [SetChatTypingHandler] })
/** The typing write command handler. */
export class ChattypingApiModule extends ConfigurableModuleClass {}
