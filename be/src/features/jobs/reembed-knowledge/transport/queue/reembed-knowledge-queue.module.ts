import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ReembedKnowledgeModule } from "../../reembed-knowledge.module"
import { ConfigurableModuleClass } from "./reembed-knowledge-queue.module-definition"
import { ReembedKnowledgeProcessor } from "./reembed-knowledge.processor"

@Module({ imports: [ReembedKnowledgeModule.register({})], providers: [ReembedKnowledgeProcessor] })
/** The queue transport of the reembed-knowledge job: registers its processor with the job runner. */
export class ReembedKnowledgeQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ReembedKnowledgeProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
