import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./knowledge.module-definition"
import { KnowledgeQueue } from "./knowledge.queue"

@Module({ providers: [KnowledgeQueue], exports: [KnowledgeQueue] })
/** The knowledge queue: its typed producer, imported by the domain module whose service enqueues. */
export class KnowledgeQueueModule extends ConfigurableModuleClass {}
