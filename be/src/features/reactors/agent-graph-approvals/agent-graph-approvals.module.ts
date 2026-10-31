import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-graph-approvals.module-definition"
import { SettleGraphAskHandler } from "./application/settle-graph-ask.handler"

@Module({ providers: [SettleGraphAskHandler] })
/** The agent graph approvals reactor: the handlers its consumers dispatch to. */
export class AgentGraphApprovalsModule extends ConfigurableModuleClass {}
