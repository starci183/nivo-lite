import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./knowledge.module-definition"
import { KnowledgeQueue } from "./knowledge.queue"

@Module({ providers: [KnowledgeQueue], exports: [KnowledgeQueue] })
/** The knowledge queue: its typed producer, imported and exported by the knowledge sources module, which the other enqueuing services reach through the injector. */
export class KnowledgeQueueModule extends ConfigurableModuleClass {}
