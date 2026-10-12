import { Module } from "@nestjs/common"
import { AgentsQueue } from "./agents.queue"

@Module({ providers: [AgentsQueue], exports: [AgentsQueue] })
/** The agents queue: its typed producer, imported by the domain module whose services enqueue. */
export class AgentsQueueModule {}
