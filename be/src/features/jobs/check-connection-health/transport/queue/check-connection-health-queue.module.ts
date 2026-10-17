import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { CheckConnectionHealthModule } from "../../check-connection-health.module"
import { ConfigurableModuleClass } from "./check-connection-health-queue.module-definition"
import { CheckConnectionHealthProcessor } from "./check-connection-health.processor"

@Module({ imports: [CheckConnectionHealthModule.register({})], providers: [CheckConnectionHealthProcessor] })
/** The queue transport of the check-connection-health job: registers its processor with the job runner; the app registers the scheduler that ticks it. */
export class CheckConnectionHealthQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: CheckConnectionHealthProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
