import { Global, Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./knowledge.module-definition"
import { KnowledgeQueue } from "./knowledge.queue"

@Global()
@Module({ providers: [KnowledgeQueue], exports: [KnowledgeQueue] })
/** The knowledge queue: its typed producer, registered once at the app root for every service that enqueues. */
export class KnowledgeQueueModule extends ConfigurableModuleClass {}
