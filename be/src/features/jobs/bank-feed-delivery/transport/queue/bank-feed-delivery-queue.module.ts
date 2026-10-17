import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { BankFeedDeliveryJobModule } from "../../bank-feed-delivery.module"
import { ConfigurableModuleClass } from "./bank-feed-delivery-queue.module-definition"
import { BankFeedDeliveryProcessor } from "./bank-feed-delivery.processor"

@Module({ imports: [BankFeedDeliveryJobModule.register({})], providers: [BankFeedDeliveryProcessor] })
/** Registers the bank-feed receipt processor with the composed fenced job runner. */
export class BankFeedDeliveryQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: BankFeedDeliveryProcessor,
    ) {
        super()
    }

    /** Subscribes the processor to the bank-feed receipt queue. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
