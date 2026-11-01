import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { DeliverGenericWebhookModule } from "../../deliver-generic-webhook.module"
import { ConfigurableModuleClass } from "./deliver-generic-webhook-queue.module-definition"
import { DeliverGenericWebhookProcessor } from "./deliver-generic-webhook.processor"

@Module({ imports: [DeliverGenericWebhookModule.register({})], providers: [DeliverGenericWebhookProcessor] })
/** The queue transport of the generic-webhook job: registers its processor with the job runner, which an api or worker app composes; a received event enqueues it. */
export class DeliverGenericWebhookQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DeliverGenericWebhookProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
