import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { RefreshZaloTokensModule } from "../../refresh-zalo-tokens.module"
import { RefreshZaloTokensProcessor } from "./refresh-zalo-tokens.processor"

@Module({ imports: [RefreshZaloTokensModule], providers: [RefreshZaloTokensProcessor] })
/** The queue transport of the refresh-zalo-tokens job: registers its processor with the job runner; the app registers the scheduler that ticks it. */
export class RefreshZaloTokensQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: RefreshZaloTokensProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
