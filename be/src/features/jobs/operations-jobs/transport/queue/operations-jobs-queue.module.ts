import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { OperationsJobsModule } from "../../operations-jobs.module"
import { DeductOrderProcessor } from "./deduct-order.processor"
import { InventoryCommandProcessor } from "./inventory-command.processor"
import { ReplenishStockProcessor } from "./replenish-stock.processor"
import { ShiftsCommandProcessor } from "./shifts-command.processor"

@Module({
    imports: [OperationsJobsModule],
    providers: [DeductOrderProcessor, ReplenishStockProcessor, InventoryCommandProcessor, ShiftsCommandProcessor],
})
/** The queue transport of the operations jobs: registers their processors with the job runner, which an api or worker app composes. */
export class OperationsJobsQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly deduct: DeductOrderProcessor,
        private readonly replenish: ReplenishStockProcessor,
        private readonly inventoryCommand: InventoryCommandProcessor,
        private readonly shiftsCommand: ShiftsCommandProcessor,
    ) {}

    /** Hands the processors to the registry. */
    onModuleInit(): void {
        this.registry.add(this.deduct)
        this.registry.add(this.replenish)
        this.registry.add(this.inventoryCommand)
        this.registry.add(this.shiftsCommand)
    }
}
