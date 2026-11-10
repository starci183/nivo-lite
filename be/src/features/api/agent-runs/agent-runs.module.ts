import { Module } from "@nestjs/common"
import { CancelAgentRunHandler } from "./application/cancel-agent-run.handler"
import { DecideRunStopHandler } from "./application/decide-run-stop.handler"
import { ResumeAgentRunHandler } from "./application/resume-agent-run.handler"
import { ConfigurableModuleClass } from "./agent-runs.module-definition"

@Module({ providers: [ResumeAgentRunHandler, CancelAgentRunHandler, DecideRunStopHandler] })
/** The agent-runs feature: the owner's operations on the durable runs of the agents, and the decisions on the stops of thread runs. */
export class AgentRunsApiModule extends ConfigurableModuleClass {}
