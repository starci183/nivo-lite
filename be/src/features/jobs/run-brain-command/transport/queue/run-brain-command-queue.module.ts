import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunBrainCommandModule } from "../../run-brain-command.module"
import { RunBrainCommandProcessor } from "./run-brain-command.processor"

@Module({ imports: [RunBrainCommandModule], providers: [RunBrainCommandProcessor] })
/** The queue transport of the run-brain-command job: registers its processor with the job runner. */
export class RunBrainCommandQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunBrainCommandProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
