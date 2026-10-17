import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { CreatePaymentOrderModule } from "../../create-payment-order.module"
import { ConfigurableModuleClass } from "./create-payment-order-queue.module-definition"
import { CreatePaymentOrderProcessor } from "./create-payment-order.processor"

@Module({ imports: [CreatePaymentOrderModule.register({})], providers: [CreatePaymentOrderProcessor] })
/** The queue transport of the create-payment-order job: registers its processor with the job runner; the request rpc enqueues it. */
export class CreatePaymentOrderQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: CreatePaymentOrderProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
