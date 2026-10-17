import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { VietcombankDeliveryJobModule } from "../../vietcombank-delivery.module"
import { ConfigurableModuleClass } from "./vietcombank-delivery-queue.module-definition"
import { VietcombankDeliveryProcessor } from "./vietcombank-delivery.processor"

@Module({ imports: [VietcombankDeliveryJobModule.register({})], providers: [VietcombankDeliveryProcessor] })
/** Registers the vietcombank receipt processor with the composed fenced job runner. */
export class VietcombankDeliveryQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: VietcombankDeliveryProcessor,
    ) {
        super()
    }

    /** Subscribes the processor to the vietcombank receipt queue. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
