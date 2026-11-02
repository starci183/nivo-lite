import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./agent-step.module-definition"
import { AgentStepQueue } from "./agent-step.queue"

@Module({
    providers: [AgentStepQueue],
    exports: [AgentStepQueue],
})
/** The agent-step queue: its typed producer, imported by the one domain module that owns it. */
export class AgentStepQueueModule extends ConfigurableModuleClass {}
