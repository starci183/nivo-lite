import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./inventory-order.module-definition"
import { InventoryOrderQueue } from "./inventory-order.queue"

@Module({ providers: [InventoryOrderQueue], exports: [InventoryOrderQueue] })
/** The inventory-order queue: its typed producer, imported by the module that confirms orders. */
export class InventoryOrderModule extends ConfigurableModuleClass {}
