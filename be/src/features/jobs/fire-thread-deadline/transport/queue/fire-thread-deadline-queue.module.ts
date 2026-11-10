import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { FireThreadDeadlineModule } from "../../fire-thread-deadline.module"
import { ConfigurableModuleClass } from "./fire-thread-deadline-queue.module-definition"
import { FireThreadDeadlineProcessor } from "./fire-thread-deadline.processor"

@Module({ imports: [FireThreadDeadlineModule.register({})], providers: [FireThreadDeadlineProcessor] })
/** The queue transport of the fire-thread-deadline job: registers its processor with the job runner; a stopped thread arms the job. */
export class FireThreadDeadlineQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: FireThreadDeadlineProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
