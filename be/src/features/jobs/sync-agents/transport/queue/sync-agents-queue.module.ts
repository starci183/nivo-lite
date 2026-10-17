import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SyncAgentsModule } from "../../sync-agents.module"
import { ConfigurableModuleClass } from "./sync-agents-queue.module-definition"
import { SyncAgentsProcessor } from "./sync-agents.processor"

@Module({ imports: [SyncAgentsModule.register({})], providers: [SyncAgentsProcessor] })
/** The queue transport of the sync-agents job: registers its processor with the job runner, which an api or worker app composes. */
export class SyncAgentsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SyncAgentsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
