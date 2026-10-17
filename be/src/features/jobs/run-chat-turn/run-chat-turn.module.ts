import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./run-chat-turn.module-definition"
import { ReplyStep } from "./steps/reply.step"

@Module({ providers: [ReplyStep], exports: [ReplyStep] })
/** The application of the run-chat-turn job: its step; the queue transport module imports it. */
export class RunChatTurnModule extends ConfigurableModuleClass {}
