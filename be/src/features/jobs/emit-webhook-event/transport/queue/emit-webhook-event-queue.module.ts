import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { EmitWebhookEventModule } from "../../emit-webhook-event.module"
import { ConfigurableModuleClass } from "./emit-webhook-event-queue.module-definition"
import { EmitWebhookEventProcessor } from "./emit-webhook-event.processor"

@Module({ imports: [EmitWebhookEventModule.register({})], providers: [EmitWebhookEventProcessor] })
/** The queue transport of the emit-webhook-event job: registers its processor with the job runner, which the api or worker app composes. */
export class EmitWebhookEventQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: EmitWebhookEventProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
