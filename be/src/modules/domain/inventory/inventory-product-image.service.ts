import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InventoryError, InventoryErrorCode } from "./errors/inventory.error"
import { InjectInventoryAssets } from "./inventory.decorators"
import { isPublicProductImage } from "./inventory-image.policy"
import type { ProductImage } from "./inventory-product-image.contracts"
import { InventoryItemEntity } from "./persistence/entities"

/** The bucket item photos are kept in. */
const IMAGE_BUCKET = "media"

@Injectable()
/**
 * Reads the public photo of one catalogue item. It answers only a photo kept under the public product folder of an item that is on
 * sale, whoever asks; any other file of the store, and any item without a photo, is not found. There is no listing.
 */
export class InventoryProductImageService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInventoryAssets() private readonly assets: StorageAssetsPort,
    ) {}

    /** The photo of the active item with `itemId`; an item without a photo the public may see, or a file the store cannot give, is not found. */
    async read(itemId: string): Promise<ProductImage> {
        const item = await this.entityManager.findOne(InventoryItemEntity, { where: { id: itemId, active: true } })
        if (item === null || !isPublicProductImage(item.imagePath) || item.imageType === null) throw notFound()
        const file = await this.assets.download(IMAGE_BUCKET, item.imagePath)
        if (file.error !== null) throw notFound()
        return { bytes: Buffer.from(await file.data.arrayBuffer()), contentType: item.imageType }
    }
}

const notFound = (): InventoryError => new InventoryError({ code: InventoryErrorCode.ItemNotFound })
