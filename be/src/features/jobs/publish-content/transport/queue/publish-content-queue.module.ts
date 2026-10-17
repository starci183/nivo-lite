import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { PublishContentModule } from "../../publish-content.module"
import { ConfigurableModuleClass } from "./publish-content-queue.module-definition"
import { PublishContentProcessor } from "./publish-content.processor"

@Module({ imports: [PublishContentModule.register({})], providers: [PublishContentProcessor] })
/** The queue transport of the publish-content job: registers its processor with the job runner, which an api or worker app composes; the pg_cron scheduler of the content tick feeds it. */
export class PublishContentQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: PublishContentProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
