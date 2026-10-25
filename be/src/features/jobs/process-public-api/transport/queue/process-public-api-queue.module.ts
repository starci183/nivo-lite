import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ProcessPublicApiJobModule } from "../../process-public-api.module"
import { ConfigurableModuleClass } from "./process-public-api-queue.module-definition"
import { PublicApiRequestProcessor, LegacyPublicApiRequestProcessor } from "./process-public-api.processor"

@Module({
    imports: [ProcessPublicApiJobModule.register({})],
    providers: [PublicApiRequestProcessor, LegacyPublicApiRequestProcessor],
})
/** Registers the public API queue with the existing fenced runner and its retry transport. */
export class ProcessPublicApiQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: PublicApiRequestProcessor,
        private readonly legacyProcessor: LegacyPublicApiRequestProcessor,
    ) {
        super()
    }

    /** Subscribes both the current named request and the supported historical queue job name. */
    onModuleInit(): void {
        this.registry.add(this.processor)
        this.registry.add(this.legacyProcessor)
    }
}
