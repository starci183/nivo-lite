import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SweepRealtimeEventsModule } from "../../sweep-realtime-events.module"
import { ConfigurableModuleClass } from "./sweep-realtime-events-queue.module-definition"
import { SweepRealtimeEventsProcessor } from "./sweep-realtime-events.processor"

@Module({ imports: [SweepRealtimeEventsModule.register({})], providers: [SweepRealtimeEventsProcessor] })
/**
 * The queue transport of the sweep-realtime-events job: registers its processor with the job runner; pg_cron enqueues its tick. The
 * processor is always registered, so a tick never waits unread: on a hub with no replay table the retention answers it with nothing to sweep.
 */
export class SweepRealtimeEventsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SweepRealtimeEventsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
