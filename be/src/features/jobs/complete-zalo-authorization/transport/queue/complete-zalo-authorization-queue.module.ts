import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { CompleteZaloAuthorizationModule } from "../../complete-zalo-authorization.module"
import { ConfigurableModuleClass } from "./complete-zalo-authorization-queue.module-definition"
import { CompleteZaloAuthorizationProcessor } from "./complete-zalo-authorization.processor"

@Module({ imports: [CompleteZaloAuthorizationModule.register({})], providers: [CompleteZaloAuthorizationProcessor] })
/** The queue transport of the complete-zalo-authorization job: registers its processor with the job runner. */
export class CompleteZaloAuthorizationQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: CompleteZaloAuthorizationProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
