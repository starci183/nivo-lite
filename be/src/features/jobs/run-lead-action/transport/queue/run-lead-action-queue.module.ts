import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RunLeadActionModule } from "../../run-lead-action.module"
import { ConfigurableModuleClass } from "./run-lead-action-queue.module-definition"
import { RunLeadActionProcessor } from "./run-lead-action.processor"

@Module({ imports: [RunLeadActionModule.register({})], providers: [RunLeadActionProcessor] })
/** Registers the lead-action processor when the API app boots. */
export class RunLeadActionQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RunLeadActionProcessor,
    ) {
        super()
    }

    /** Adds the queue consumer to the standard job runner. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
