import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { MetaDeliveryJobModule } from "../../meta-delivery.module"
import { ConfigurableModuleClass } from "./meta-delivery-queue.module-definition"
import { MetaDeliveryProcessor } from "./meta-delivery.processor"

@Module({ imports: [MetaDeliveryJobModule.register({})], providers: [MetaDeliveryProcessor] })
/** Registers the meta receipt processor with the composed fenced job runner. */
export class MetaDeliveryQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: MetaDeliveryProcessor,
    ) {
        super()
    }

    /** Subscribes the processor to the meta receipt queue. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
