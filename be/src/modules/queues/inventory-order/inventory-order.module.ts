import { Module } from "@nestjs/common"
import { InventoryOrderQueue } from "./inventory-order.queue"

@Module({ providers: [InventoryOrderQueue], exports: [InventoryOrderQueue] })
/** The inventory-order queue: its typed producer, imported by the module that confirms orders. */
export class InventoryOrderModule {}
