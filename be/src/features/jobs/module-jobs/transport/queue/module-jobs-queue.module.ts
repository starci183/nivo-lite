import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ModuleJobsModule } from "../../module-jobs.module"
import { ConfigurableModuleClass } from "./module-jobs-queue.module-definition"
import { ModuleJobsProcessor } from "./module-jobs.processor"

@Module({ imports: [ModuleJobsModule.register({})], providers: [ModuleJobsProcessor] })
/** Registers the module-jobs processor when the app that runs jobs boots. */
export class RunModuleJobQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ModuleJobsProcessor,
    ) {
        super()
    }

    /** Adds the queue consumer to the standard job runner. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
