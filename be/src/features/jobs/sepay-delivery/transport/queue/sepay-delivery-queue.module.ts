import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SepayDeliveryJobModule } from "../../sepay-delivery.module"
import { ConfigurableModuleClass } from "./sepay-delivery-queue.module-definition"
import { SepayDeliveryProcessor } from "./sepay-delivery.processor"

@Module({ imports: [SepayDeliveryJobModule.register({})], providers: [SepayDeliveryProcessor] })
/** Registers the sepay receipt processor with the composed fenced job runner. */
export class SepayDeliveryQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SepayDeliveryProcessor,
    ) {
        super()
    }

    /** Subscribes the processor to the sepay receipt queue. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
