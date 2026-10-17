import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunAutomationTickModule } from "../../run-automation-tick.module"
import { ConfigurableModuleClass } from "./run-automation-tick-queue.module-definition"
import { RunAutomationTickProcessor } from "./run-automation-tick.processor"

@Module({ imports: [RunAutomationTickModule.register({})], providers: [RunAutomationTickProcessor] })
/** The queue transport of the run-automation-tick job: registers its processor with the job runner, which the api or worker app composes. */
export class RunAutomationTickQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunAutomationTickProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
