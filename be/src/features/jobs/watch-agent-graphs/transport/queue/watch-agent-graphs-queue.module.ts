import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { WatchAgentGraphsModule } from "../../watch-agent-graphs.module"
import { ConfigurableModuleClass } from "./watch-agent-graphs-queue.module-definition"
import { WatchAgentGraphsProcessor } from "./watch-agent-graphs.processor"

@Module({ imports: [WatchAgentGraphsModule.register({})], providers: [WatchAgentGraphsProcessor] })
/** The queue transport of the watch-agent-graphs job: registers its processor with the job runner, which an api or worker app composes. */
export class WatchAgentGraphsQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: WatchAgentGraphsProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
