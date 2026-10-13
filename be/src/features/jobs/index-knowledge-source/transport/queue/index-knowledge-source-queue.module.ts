import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { IndexKnowledgeSourceModule } from "../../index-knowledge-source.module"
import { IndexKnowledgeSourceProcessor } from "./index-knowledge-source.processor"

@Module({ imports: [IndexKnowledgeSourceModule], providers: [IndexKnowledgeSourceProcessor] })
/** The queue transport of the index-knowledge-source job: registers its processor with the job runner. */
export class IndexKnowledgeSourceQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: IndexKnowledgeSourceProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
