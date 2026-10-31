import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-wakes.module-definition"
import { SeedAgentTriggersHandler } from "./application/seed-agent-triggers.handler"
import { WakeAgentsHandler } from "./application/wake-agents.handler"

@Module({ providers: [WakeAgentsHandler, SeedAgentTriggersHandler] })
/** The agent-wakes reactor: the handlers its consumers dispatch to. */
export class AgentWakesModule extends ConfigurableModuleClass {}
