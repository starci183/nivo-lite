import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./inventory-replenish.module-definition"
import { InventoryReplenishQueue } from "./inventory-replenish.queue"

@Module({ providers: [InventoryReplenishQueue], exports: [InventoryReplenishQueue] })
/** The inventory-replenish queue: its typed producer, imported by the domain module whose service enqueues. */
export class InventoryReplenishModule extends ConfigurableModuleClass {}
