import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { InventoryReplenishModule } from "@modules/queues/inventory-replenish"
import { InventoryAutomationService } from "./inventory-automation.service"
import { InventoryCatalogService } from "./inventory-catalog.service"
import { INVENTORY_ASSETS, INVENTORY_PUBLIC_API_URL } from "./inventory.decorators"
import { UNBOUND_ASSETS } from "./inventory-unbound-assets"
import { InventoryProductImageService } from "./inventory-product-image.service"
import { InventoryGraphService } from "./inventory-graph.service"
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
import { InventorySeedService } from "./inventory-seed.service"
import { InventoryStockService } from "./inventory-stock.service"
import { InventoryWorkbenchService } from "./inventory-workbench.service"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inventory.module-definition"

@Module({})
/** The inventory capability over the primary PostgreSQL connection: catalogue, stock, purchasing and the routine inventory jobs. */
export class InventoryModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app; the seed mode (the cli app) registers the seed write of catalogue items alone. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const photos = [
            options.assets === undefined
                ? { provide: INVENTORY_ASSETS, useValue: UNBOUND_ASSETS }
                : { provide: INVENTORY_ASSETS, useExisting: options.assets },
            { provide: INVENTORY_PUBLIC_API_URL, useValue: options.publicApiUrl ?? "" },
        ]
        if (options.seedOnly === true) {
            return {
                ...base,
                providers: [...(base.providers ?? []), ...photos, InventorySeedService],
                exports: [InventorySeedService],
            }
        }
        return {
            ...base,
            imports: [...(base.imports ?? []), InventoryReplenishModule.register({})],
            providers: [
                ...(base.providers ?? []),
                ...photos,
                InventoryProductImageService,
                { provide: INBOX, useClass: InboxService },
                InventoryLocationsService,
                InventoryMovementsService,
                InventoryOrderMessageService,
                InventoryOrdersService,
                InventoryDispatchService,
                InventoryReplenishService,
                InventoryReceivingService,
                InventoryCatalogService,
                InventoryGraphService,
                InventoryImportService,
                InventoryDeductionService,
                InventoryStockService,
                InventoryAutomationService,
                InventoryPerformersService,
                InventoryWorkbenchService,
            ],
            exports: [
                InventoryAutomationService,
                InventoryCatalogService,
                InventoryImportService,
                InventoryProductImageService,
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
