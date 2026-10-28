import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SweepSystemHistoryModule } from "../../sweep-system-history.module"
import { ConfigurableModuleClass } from "./sweep-system-history-queue.module-definition"
import { SweepSystemHistoryProcessor } from "./sweep-system-history.processor"

@Module({ imports: [SweepSystemHistoryModule.register({})], providers: [SweepSystemHistoryProcessor] })
/** The queue transport of the sweep-system-history job: registers its processor with the job runner; pg_cron enqueues its end-of-day tick. */
export class SweepSystemHistoryQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SweepSystemHistoryProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
