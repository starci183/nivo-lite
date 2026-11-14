import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { SyncVectorsModule } from "../../sync-vectors.module"
import { ConfigurableModuleClass } from "./sync-vectors-queue.module-definition"
import { SyncVectorsProcessor } from "./sync-vectors.processor"

@Module({ imports: [SyncVectorsModule.register({})], providers: [SyncVectorsProcessor] })
/** The queue transport of the sync-vectors job: registers its processor with the job runner. */
export class SyncVectorsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SyncVectorsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
