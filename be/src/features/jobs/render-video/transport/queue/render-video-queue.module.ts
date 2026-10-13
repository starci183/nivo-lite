import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RenderVideoModule } from "../../render-video.module"
import { RenderVideoProcessor } from "./render-video.processor"

@Module({ imports: [RenderVideoModule], providers: [RenderVideoProcessor] })
/** The queue transport of the render-video job: registers its processor with the job runner, which an api or worker app composes; a new render enqueues it. */
export class RenderVideoQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RenderVideoProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
