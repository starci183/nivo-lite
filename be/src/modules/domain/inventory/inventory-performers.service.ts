import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { ActionPerformerRegistry } from "@modules/domain/module-ops"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryStockService } from "./inventory-stock.service"

@Injectable()
/** Registers the performers of the inventory actions with the approval gate: what runs once an action is allowed. */
export class InventoryPerformersService implements OnModuleInit {
    constructor(
        private readonly registry: ActionPerformerRegistry,
        private readonly stock: InventoryStockService,
        private readonly dispatch: InventoryDispatchService,
    ) {}

    /** Hands the adjust_stock and send_purchase_order performers to the registry. */
    onModuleInit(): void {
        this.registry.add({ action: "adjust_stock", perform: (context) => this.stock.performAdjustStock(context) })
        this.registry.add({
            action: "send_purchase_order",
            perform: (context) => this.dispatch.performSendPurchaseOrder(context),
            reject: (context) => this.dispatch.rejectSendPurchaseOrder(context),
        })
    }
}
