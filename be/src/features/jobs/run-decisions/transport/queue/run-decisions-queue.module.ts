import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunDecisionsModule } from "../../run-decisions.module"
import { DecisionsProcessor } from "./decisions.processor"

@Module({ imports: [RunDecisionsModule], providers: [DecisionsProcessor] })
/** Registers the decisions processor with the job runner when the app boots. */
export class RunDecisionsQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DecisionsProcessor,
    ) {}

    /** Adds the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
