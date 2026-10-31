import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ReviewDossiersModule } from "../../review-dossiers.module"
import { ConfigurableModuleClass } from "./review-dossiers-queue.module-definition"
import { ReviewDossiersProcessor } from "./review-dossiers.processor"

@Module({ imports: [ReviewDossiersModule.register({})], providers: [ReviewDossiersProcessor] })
/** The queue transport of the review-dossiers job: registers its processor with the job runner. */
export class ReviewDossiersQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ReviewDossiersProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
