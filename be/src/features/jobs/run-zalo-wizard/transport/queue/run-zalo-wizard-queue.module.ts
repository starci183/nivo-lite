import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunZaloWizardModule } from "../../run-zalo-wizard.module"
import { RunZaloWizardProcessor } from "./run-zalo-wizard.processor"

@Module({ imports: [RunZaloWizardModule], providers: [RunZaloWizardProcessor] })
/** The queue transport of the run-zalo-wizard job: registers its processor with the job runner. */
export class RunZaloWizardQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunZaloWizardProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
