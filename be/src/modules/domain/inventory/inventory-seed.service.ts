import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import { InjectInventoryAssets } from "./inventory.decorators"
import { productImagePathOf } from "./inventory-image.policy"
import type { SeedItemImage, SeedItemOutcome, SeedItemParams } from "./inventory-seed.contracts"
import { InventoryItemEntity } from "./persistence/entities"

/** The bucket item photos are kept in. */
const IMAGE_BUCKET = "media"

/** True when the stored item already is the wanted one: same name, unit and price, and on; and, when the seed gives a photo, that photo is the one it points to. */
const holds = (stored: InventoryItemEntity, wanted: SeedItemParams, imagePath: string | null): boolean =>
    stored.name === wanted.name &&
    stored.unit === wanted.unit &&
    Number(stored.sellPriceVnd) === wanted.sellPriceVnd &&
    stored.active &&
    (imagePath === null || stored.imagePath === imagePath)

const savedIdOf = (rows: ReadonlyArray<{ readonly inventory_save_item?: string }>): string | null =>
    rows[0]?.inventory_save_item ?? null

@Injectable()
/**
 * The seed write of the catalogue items of a workspace, with no member behind it (the cli seeds the stack's data). The sku is the key:
 * an item that already is the wanted one is kept, and one that differs is brought back to it, keeping its cost, stock levels and aliases.
 * A seed that gives a photo has it written to the media bucket under the public product folder and pointed to from the item.
 */
export class InventorySeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInventoryAssets() private readonly assets: StorageAssetsPort,
    ) {}

    /** Ensures the workspace holds `item` as wanted, switching a turned-off item back on; answers what it did. */
    async ensureItem(workspaceId: string, item: SeedItemParams): Promise<SeedItemOutcome> {
        const stored = await this.entityManager.findOne(InventoryItemEntity, { where: { workspaceId, sku: item.sku } })
        const imagePath = await this.storedImage(workspaceId, item)
        if (stored !== null && holds(stored, item, imagePath)) return "kept"
        const saved = await callDbFunction<{ readonly inventory_save_item?: string }>(
            this.entityManager,
            "public.inventory_save_item",
            [
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
            ],
        )
        if (stored !== null && !stored.active) {
            await callDbFunction(this.entityManager, "public.inventory_set_item_active", [workspaceId, stored.id, true])
        }
        const id = stored?.id ?? savedIdOf(saved)
        if (item.image !== undefined && imagePath !== null && id !== null) {
            await this.entityManager.update(
                InventoryItemEntity,
                { id, workspaceId },
                { imagePath, imageType: item.image.contentType },
            )
        }
        return stored === null ? "created" : "updated"
    }

    /** Writes the photo of the seed item to the file store and answers its path; null when the seed gives none. */
    private async storedImage(workspaceId: string, item: SeedItemParams): Promise<string | null> {
        const image: SeedItemImage | undefined = item.image
        if (image === undefined) return null
        const path = productImagePathOf(workspaceId, item.sku, image.contentType)
        if (path === null) {
            throw new InventoryError({ code: InventoryErrorCode.ItemImageNotStored })
        }
        const written = await this.assets.upload(IMAGE_BUCKET, path, image.bytes, image.contentType)
        if (written.error !== null) throw new InventoryError({ code: InventoryErrorCode.ItemImageNotStored })
        return path
    }
}
