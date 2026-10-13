import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunLeadActionModule } from "../../run-lead-action.module"
import { RunLeadActionProcessor } from "./run-lead-action.processor"

@Module({ imports: [RunLeadActionModule], providers: [RunLeadActionProcessor] })
/** Registers the lead-action processor when the API app boots. */
export class RunLeadActionQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunLeadActionProcessor,
    ) {}

    /** Adds the queue consumer to the standard job runner. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
