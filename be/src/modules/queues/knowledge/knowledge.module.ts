import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./knowledge.module-definition"
import { KnowledgeQueue } from "./knowledge.queue"
import { KNOWLEDGE_QUEUE_PRODUCER } from "./knowledge.decorators"

@Module({
    providers: [KnowledgeQueue, { provide: KNOWLEDGE_QUEUE_PRODUCER, useExisting: KnowledgeQueue }],
    exports: [KnowledgeQueue, KNOWLEDGE_QUEUE_PRODUCER],
})
/** The knowledge queue: its typed producer, imported and exported by the knowledge sources module, which the other enqueuing services reach through the injector. */
export class KnowledgeQueueModule extends ConfigurableModuleClass {}
