import { Module } from "@nestjs/common"
import { InventoryApiModule } from "../../inventory.module"
import { InventoryController } from "./inventory.controller"

@Module({ imports: [InventoryApiModule], controllers: [InventoryController] })
/** The HTTP transport of the inventory feature. */
export class InventoryHttpModule {}
