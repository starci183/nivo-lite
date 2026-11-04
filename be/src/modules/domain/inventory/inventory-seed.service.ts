import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import type { SeedItemOutcome, SeedItemParams } from "./inventory-seed.contracts"
import { InventoryItemEntity } from "./persistence/entities"

/** True when the stored item already is the wanted one: same name, unit and price, and on. */
const holds = (stored: InventoryItemEntity, wanted: SeedItemParams): boolean =>
    stored.name === wanted.name &&
    stored.unit === wanted.unit &&
    Number(stored.sellPriceVnd) === wanted.sellPriceVnd &&
    stored.active

@Injectable()
/**
 * The seed write of the catalogue items of a workspace, with no member behind it (the cli seeds the stack's data). The sku is the key:
 * an item that already is the wanted one is kept, and one that differs is brought back to it, keeping its cost, stock levels and aliases.
 */
export class InventorySeedService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Ensures the workspace holds `item` as wanted, switching a turned-off item back on; answers what it did. */
    async ensureItem(workspaceId: string, item: SeedItemParams): Promise<SeedItemOutcome> {
        const stored = await this.entityManager.findOne(InventoryItemEntity, { where: { workspaceId, sku: item.sku } })
        if (stored !== null && holds(stored, item)) return "kept"
        await callDbFunction(this.entityManager, "public.inventory_save_item", [
            workspaceId,
            stored?.id ?? null,
            item.sku,
            item.name,
            item.unit,
            JSON.stringify(stored?.units ?? []),
            stored?.category ?? "",
            stored?.costVnd ?? 0,
            item.sellPriceVnd,
            stored?.reorderPoint ?? 0,
            stored?.reorderQty ?? 0,
            stored?.supplierId ?? null,
            stored?.aliases ?? [],
        ])
        if (stored !== null && !stored.active) {
            await callDbFunction(this.entityManager, "public.inventory_set_item_active", [workspaceId, stored.id, true])
        }
        return stored === null ? "created" : "updated"
    }
}
