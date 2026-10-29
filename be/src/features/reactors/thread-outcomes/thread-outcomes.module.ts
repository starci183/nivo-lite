import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./thread-outcomes.module-definition"
import { SettleApprovalOutcomeHandler } from "./application/settle-approval-outcome.handler"

@Module({ providers: [SettleApprovalOutcomeHandler] })
/** The thread-outcomes reactor: the handlers its consumers dispatch to. */
export class ThreadOutcomesModule extends ConfigurableModuleClass {}
