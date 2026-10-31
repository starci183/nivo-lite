import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./conversation-handback.module-definition"
import { HandBackConversationHandler } from "./application/hand-back-conversation.handler"

@Module({ providers: [HandBackConversationHandler] })
/** The conversation-handback reactor: the handler its consumer dispatches to. */
export class ConversationHandbackModule extends ConfigurableModuleClass {}
