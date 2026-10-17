import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ZaloDeliveryJobModule } from "../../zalo-delivery.module"
import { ConfigurableModuleClass } from "./zalo-delivery-queue.module-definition"
import { ZaloDeliveryProcessor } from "./zalo-delivery.processor"

@Module({ imports: [ZaloDeliveryJobModule.register({})], providers: [ZaloDeliveryProcessor] })
/** Registers the zalo receipt processor with the composed fenced job runner. */
export class ZaloDeliveryQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ZaloDeliveryProcessor,
    ) {
        super()
    }

    /** Subscribes the processor to the zalo receipt queue. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
