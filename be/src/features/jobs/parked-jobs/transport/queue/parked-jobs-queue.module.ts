import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ParkedJobsModule } from "../../parked-jobs.module"
import { ConfigurableModuleClass } from "./parked-jobs-queue.module-definition"
import { ParkedJobsProcessor } from "./parked-jobs.processor"

@Module({ imports: [ParkedJobsModule.register({})], providers: [ParkedJobsProcessor] })
/** Registers the parked-jobs processor when the app that runs jobs boots. */
export class ParkedJobsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ParkedJobsProcessor,
    ) {
        super()
    }

    /** Adds the queue consumer to the standard job runner. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
