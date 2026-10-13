import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { InventoryCommandModule } from "../../inventory-command.module"
import { InventoryCommandProcessor } from "./inventory-command.processor"

@Module({ imports: [InventoryCommandModule], providers: [InventoryCommandProcessor] })
/** The queue transport of the inventory-command job: registers its processor with the job runner, which an api or worker app composes. */
export class InventoryCommandQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: InventoryCommandProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
