import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunSetupTurnModule } from "../../run-setup-turn.module"
import { RunSetupTurnProcessor } from "./run-setup-turn.processor"

@Module({ imports: [RunSetupTurnModule], providers: [RunSetupTurnProcessor] })
/** The queue transport of the run-setup-turn job: registers its processor with the job runner, which an api or worker app composes. */
export class RunSetupTurnQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunSetupTurnProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
