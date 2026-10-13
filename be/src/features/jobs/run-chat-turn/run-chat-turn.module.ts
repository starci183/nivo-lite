import { Module } from "@nestjs/common"
import { ReplyStep } from "./steps/reply.step"

@Module({ providers: [ReplyStep], exports: [ReplyStep] })
/** The application of the run-chat-turn job: its step; the queue transport module imports it. */
export class RunChatTurnModule {}
