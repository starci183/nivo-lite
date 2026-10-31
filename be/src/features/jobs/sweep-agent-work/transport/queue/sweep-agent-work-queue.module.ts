import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SweepAgentWorkModule } from "../../sweep-agent-work.module"
import { ConfigurableModuleClass } from "./sweep-agent-work-queue.module-definition"
import { SweepAgentWorkProcessor } from "./sweep-agent-work.processor"

@Module({ imports: [SweepAgentWorkModule.register({})], providers: [SweepAgentWorkProcessor] })
/** The queue transport of the sweep-agent-work job: registers its processor with the job runner; the minute tick of platform/jobs enqueues it. */
export class SweepAgentWorkQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SweepAgentWorkProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
