import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { TelegramDeliveryJobModule } from "../../telegram-delivery.module"
import { ConfigurableModuleClass } from "./telegram-delivery-queue.module-definition"
import { TelegramDeliveryProcessor } from "./telegram-delivery.processor"

@Module({ imports: [TelegramDeliveryJobModule.register({})], providers: [TelegramDeliveryProcessor] })
/** Registers the telegram receipt processor with the composed fenced job runner. */
export class TelegramDeliveryQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: TelegramDeliveryProcessor,
    ) {
        super()
    }

    /** Subscribes the processor to the telegram receipt queue. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
