import { Module, type OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry, type JobProcessorRegistry } from "@modules/platform/jobs"
import { SweepAccountDataModule } from "../../sweep-account-data.module"
import { ConfigurableModuleClass } from "./sweep-account-data-queue.module-definition"
import { SweepAccountDataProcessor } from "./sweep-account-data.processor"

@Module({ imports: [SweepAccountDataModule.register({})], providers: [SweepAccountDataProcessor] })
/** The queue transport of the sweep-account-data job: registers its processor with the job runner; the app scheduler enqueues its end-of-day tick. */
export class SweepAccountDataQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SweepAccountDataProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
