import { Module } from "@nestjs/common"
import { CancelAgentRunHandler } from "./application/cancel-agent-run.handler"
import { ResumeAgentRunHandler } from "./application/resume-agent-run.handler"
import { ConfigurableModuleClass } from "./agent-runs.module-definition"

@Module({ providers: [ResumeAgentRunHandler, CancelAgentRunHandler] })
/** The agent-runs feature: the owner's operations on the durable runs of the agents. */
export class AgentRunsApiModule extends ConfigurableModuleClass {}
