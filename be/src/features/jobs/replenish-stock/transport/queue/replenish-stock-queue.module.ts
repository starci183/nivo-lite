import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ReplenishStockModule } from "../../replenish-stock.module"
import { ReplenishStockProcessor } from "./replenish-stock.processor"

@Module({ imports: [ReplenishStockModule], providers: [ReplenishStockProcessor] })
/** The queue transport of the replenish-stock job: registers its processor with the job runner, which an api or worker app composes; the inventory capability feeds it when stock moves. */
export class ReplenishStockQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ReplenishStockProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
