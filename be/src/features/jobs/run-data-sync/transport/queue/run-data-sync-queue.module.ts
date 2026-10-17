import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunDataSyncModule } from "../../run-data-sync.module"
import { ConfigurableModuleClass } from "./run-data-sync-queue.module-definition"
import { RunDataSyncProcessor } from "./run-data-sync.processor"

@Module({ imports: [RunDataSyncModule.register({})], providers: [RunDataSyncProcessor] })
/** The queue transport of the run-data-sync job: registers its processor with the job runner; the app registers the scheduler that ticks it. */
export class RunDataSyncQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunDataSyncProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
