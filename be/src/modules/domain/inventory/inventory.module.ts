import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { InventoryReplenishModule } from "@modules/queues/inventory-replenish"
import { InventoryAutomationService } from "./inventory-automation.service"
import { InventoryCatalogService } from "./inventory-catalog.service"
import { InventoryImportService } from "./inventory-import.service"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryOrderMessageService } from "./inventory-order-message.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import { InventoryPerformersService } from "./inventory-performers.service"
import { InventoryReceivingService } from "./inventory-receiving.service"
import { InventoryReplenishService } from "./inventory-replenish.service"
import { InventoryDeductionService } from "./inventory-deduction.service"
import { OrderConfirmedInventoryConsumer } from "./order-confirmed-inventory.consumer"
import { InventoryStockService } from "./inventory-stock.service"
import { InventoryWorkbenchService } from "./inventory-workbench.service"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inventory.module-definition"

@Module({})
/** The inventory capability over the primary Supabase PostgreSQL connection: catalogue, stock, purchasing and the routine inventory jobs. */
export class InventoryModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), InventoryReplenishModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                InventoryLocationsService,
                InventoryMovementsService,
                InventoryOrderMessageService,
                InventoryOrdersService,
                InventoryDispatchService,
                InventoryReplenishService,
                InventoryReceivingService,
                InventoryCatalogService,
                InventoryImportService,
                InventoryDeductionService,
                OrderConfirmedInventoryConsumer,
                InventoryStockService,
                InventoryAutomationService,
                InventoryPerformersService,
                InventoryWorkbenchService,
            ],
            exports: [
                InventoryAutomationService,
                InventoryCatalogService,
                InventoryImportService,
                InventoryDispatchService,
                InventoryLocationsService,
                InventoryOrdersService,
                InventoryReceivingService,
                InventoryReplenishService,
                InventoryDeductionService,
                InventoryStockService,
                InventoryWorkbenchService,
            ],
        }
    }
}
