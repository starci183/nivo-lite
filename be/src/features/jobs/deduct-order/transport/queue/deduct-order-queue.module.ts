import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { DeductOrderModule } from "../../deduct-order.module"
import { ConfigurableModuleClass } from "./deduct-order-queue.module-definition"
import { DeductOrderProcessor } from "./deduct-order.processor"

@Module({ imports: [DeductOrderModule.register({})], providers: [DeductOrderProcessor] })
/** The queue transport of the deduct-order job: registers its processor with the job runner, which an api or worker app composes; the inventory capability feeds it when an order is confirmed. */
export class DeductOrderQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: DeductOrderProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
