import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { FireAgentScheduleModule } from "../../fire-agent-schedule.module"
import { ConfigurableModuleClass } from "./fire-agent-schedule-queue.module-definition"
import { FireAgentScheduleProcessor } from "./fire-agent-schedule.processor"

@Module({ imports: [FireAgentScheduleModule.register({})], providers: [FireAgentScheduleProcessor] })
/**
 * The queue transport of the fire-agent-schedule job: registers its processor with the job runner. The jobs of this queue come from the job
 * schedulers of the trigger rows, not from the outbox.
 */
export class FireAgentScheduleQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: FireAgentScheduleProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
