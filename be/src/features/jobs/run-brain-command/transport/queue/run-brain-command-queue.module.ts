import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunBrainCommandModule } from "../../run-brain-command.module"
import { ConfigurableModuleClass } from "./run-brain-command-queue.module-definition"
import { RunBrainCommandProcessor } from "./run-brain-command.processor"

@Module({ imports: [RunBrainCommandModule.register({})], providers: [RunBrainCommandProcessor] })
/** The queue transport of the run-brain-command job: registers its processor with the job runner. */
export class RunBrainCommandQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunBrainCommandProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
