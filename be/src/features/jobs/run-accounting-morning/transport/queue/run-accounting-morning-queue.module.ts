import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunAccountingMorningModule } from "../../run-accounting-morning.module"
import { ConfigurableModuleClass } from "./run-accounting-morning-queue.module-definition"
import { RunAccountingMorningProcessor } from "./run-accounting-morning.processor"

@Module({ imports: [RunAccountingMorningModule.register({})], providers: [RunAccountingMorningProcessor] })
/** The queue transport of the accounting morning job: registers its processor with the job runner. */
export class RunAccountingMorningQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunAccountingMorningProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
