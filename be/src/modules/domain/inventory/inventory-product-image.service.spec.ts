import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { inventoryItemOf } from "@tests/fixtures/builders/inventory.builder"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InventoryErrorCode } from "./errors/inventory.error"
import { INVENTORY_ASSETS } from "./inventory.decorators"
import { InventoryProductImageService } from "./inventory-product-image.service"
import { InventoryItemEntity } from "./persistence/entities"

const BYTES = Buffer.from("photo")

const build = async (item: InventoryItemEntity | null) => {
    const assets = mock<StorageAssetsPort>()
    assets.download.mockResolvedValue({ data: new Blob([BYTES]), error: null })
    const em = mockEntityManager({ findOne: [InventoryItemEntity, item] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryProductImageService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: INVENTORY_ASSETS, useValue: assets },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryProductImageService), download: assets.download, em }
}

const photoItem = (over: Parameters<typeof inventoryItemOf>[0] = {}) =>
    inventoryItemOf({ imagePath: "catalogue-public/ws-1/a.jpg", imageType: "image/jpeg", ...over })

const NOT_FOUND = { code: InventoryErrorCode.ItemNotFound }

describe("InventoryProductImageService", () => {
    it("reads the photo of an active item with its content type", async () => {
        const { service, download, em } = await build(photoItem())

        const image = await service.read("item-1")

        expect(em.findOne).toHaveBeenCalledWith(InventoryItemEntity, { where: { id: "item-1", active: true } })
        expect(download).toHaveBeenCalledWith("media", "catalogue-public/ws-1/a.jpg")
        expect(image.contentType).toBe("image/jpeg")
        expect(image.bytes.equals(BYTES)).toBe(true)
    })

    it("finds nothing for an unknown item or an item without a photo", async () => {
        await expect((await build(null)).service.read("x")).rejects.toMatchObject(NOT_FOUND)
        const bare = await build(photoItem({ imagePath: null, imageType: null }))
        await expect(bare.service.read("x")).rejects.toMatchObject(NOT_FOUND)
    })

    it("never reads a file outside the public product folder", async () => {
        const other = await build(photoItem({ imagePath: "hiring/cv.pdf" }))

        await expect(other.service.read("x")).rejects.toMatchObject(NOT_FOUND)
        expect(other.download).not.toHaveBeenCalled()
    })

    it("finds nothing when the store cannot give the file", async () => {
        const failing = await build(photoItem())
        failing.download.mockResolvedValue({ data: null, error: new Error("gone") })

        await expect(failing.service.read("item-1")).rejects.toMatchObject(NOT_FOUND)
    })
})
