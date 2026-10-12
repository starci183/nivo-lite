import { Module } from "@nestjs/common"
import { AGENTS_QUEUE_PRODUCER } from "./agents.decorators"
import { AgentsQueue } from "./agents.queue"

@Module({
    providers: [AgentsQueue, { provide: AGENTS_QUEUE_PRODUCER, useExisting: AgentsQueue }],
    exports: [AgentsQueue, AGENTS_QUEUE_PRODUCER],
})
/** The agents queue: its typed producer, imported by the one domain module that owns it and reached by the others through the injector. */
export class AgentsQueueModule {}
