import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RequestRenderModule } from "../../request-render.module"
import { ConfigurableModuleClass } from "./request-render-queue.module-definition"
import { RequestRenderProcessor } from "./request-render.processor"

@Module({ imports: [RequestRenderModule.register({})], providers: [RequestRenderProcessor] })
/** The queue transport of the request-render job: registers its processor with the job runner, which an api or worker app composes; the video render request function of the database feeds it. */
export class RequestRenderQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RequestRenderProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
