import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ExtractKnowledgeFactsModule } from "../../extract-knowledge-facts.module"
import { ConfigurableModuleClass } from "./extract-knowledge-facts-queue.module-definition"
import { ExtractKnowledgeFactsProcessor } from "./extract-knowledge-facts.processor"

@Module({ imports: [ExtractKnowledgeFactsModule.register({})], providers: [ExtractKnowledgeFactsProcessor] })
/** The queue transport of the extract-knowledge-facts job: registers its processor with the job runner. */
export class ExtractKnowledgeFactsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ExtractKnowledgeFactsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
