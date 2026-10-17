import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunAutomationCommandModule } from "../../run-automation-command.module"
import { ConfigurableModuleClass } from "./run-automation-command-queue.module-definition"
import { RunAutomationCommandProcessor } from "./run-automation-command.processor"

@Module({ imports: [RunAutomationCommandModule.register({})], providers: [RunAutomationCommandProcessor] })
/** The queue transport of the run-automation-command job: registers its processor with the job runner, which the api app composes. */
export class RunAutomationCommandQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunAutomationCommandProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
