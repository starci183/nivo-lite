import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunMarketingTickModule } from "../../run-marketing-tick.module"
import { ConfigurableModuleClass } from "./run-marketing-tick-queue.module-definition"
import { RunMarketingTickProcessor } from "./run-marketing-tick.processor"

@Module({ imports: [RunMarketingTickModule.register({})], providers: [RunMarketingTickProcessor] })
/** The queue transport of the AI Marketing tick job: registers its processor with the job runner. */
export class RunMarketingTickQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunMarketingTickProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
