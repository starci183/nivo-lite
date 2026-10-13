import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunLeadGenModule } from "../../run-lead-gen.module"
import { RunLeadGenProcessor } from "./run-lead-gen.processor"

@Module({ imports: [RunLeadGenModule], providers: [RunLeadGenProcessor] })
/** Registers the lead generation processor when the API app boots. */
export class RunLeadGenQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunLeadGenProcessor,
    ) {}

    /** Adds the queue consumer to the standard job runner. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
