import { Module } from "@nestjs/common"
import { AGENT_TURN_QUEUE_PRODUCER } from "./agent-turn.decorators"
import { ConfigurableModuleClass } from "./agent-turn.module-definition"
import { AgentTurnQueue } from "./agent-turn.queue"

@Module({
    providers: [AgentTurnQueue, { provide: AGENT_TURN_QUEUE_PRODUCER, useExisting: AgentTurnQueue }],
    exports: [AgentTurnQueue, AGENT_TURN_QUEUE_PRODUCER],
})
/** The agent-turn queue: its typed producer, imported by the one domain module that owns it. */
export class AgentTurnQueueModule extends ConfigurableModuleClass {}
