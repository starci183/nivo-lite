import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { inventoryItemOf } from "@tests/fixtures/builders/inventory.builder"
import { SAVE_ITEM, SET_ITEM_ACTIVE } from "@tests/fixtures/builders/inventory-calls.builder"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INVENTORY_ASSETS } from "./inventory.decorators"
import { InventoryItemEntity } from "./persistence/entities"
import { InventorySeedService } from "./inventory-seed.service"

const ITEM = { sku: "CHAU-MINI", name: "Mini pot", unit: "pot", sellPriceVnd: 5000 }

const STORED = {
    id: "item-1",
    workspaceId: "ws-1",
    sku: "CHAU-MINI",
    name: "Mini pot",
    unit: "pot",
    units: [{ unit: "box", factor: 10 }],
    category: "Hoa",
    costVnd: "2000.00",
    sellPriceVnd: "5000.00",
    reorderPoint: "3.000",
    reorderQty: "10.000",
    supplierId: "supplier-1",
    aliases: ["chau"],
    active: true,
}

const stored = (over: Parameters<typeof inventoryItemOf>[0] = {}): InventoryItemEntity =>
    inventoryItemOf({ ...STORED, ...over })

const PHOTO = { contentType: "image/jpeg", bytes: Buffer.from("jpeg-bytes") }
const PHOTO_PATH = "catalogue-public/ws-1/chau-mini.jpg"

const build = async (found: InventoryItemEntity | null, store: "ok" | "down" = "ok") => {
    const assets = mock<StorageAssetsPort>()
    assets.upload.mockResolvedValue({ error: store === "down" ? new Error("down") : null })
    const em: MockEntityManager = mockEntityManager({
        findOne: [InventoryItemEntity, found],
        update: [InventoryItemEntity, { affected: 1 }],
        query: [SAVE_ITEM, [{ inventory_save_item: "item-1" }]],
    })
    const calls: Array<string> = []
    em.query.mockImplementation((statement: string) => {
        calls.push(statement)
        return Promise.resolve(statement === SET_ITEM_ACTIVE ? [] : [{ inventory_save_item: "item-1" }])
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventorySeedService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: INVENTORY_ASSETS, useValue: assets },
        ],
    }).compile()
    return { service: moduleRef.get(InventorySeedService), em, calls, upload: assets.upload }
}

describe("InventorySeedService > ensureItem", () => {
    it("creates an item the workspace does not have, with the price and no cost, stock rule or alias", async () => {
        const { service, em, calls } = await build(null)

        await expect(service.ensureItem("ws-1", ITEM)).resolves.toBe("created")

        expect(em.findOne).toHaveBeenCalledWith(InventoryItemEntity, {
            where: { workspaceId: "ws-1", sku: "CHAU-MINI" },
        })
        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1",
            null,
            "CHAU-MINI",
            "Mini pot",
            "pot",
            "[]",
            "",
            0,
            5000,
            0,
            0,
            null,
            [],
        ])
        expect(calls).toEqual([SAVE_ITEM])
    })

    it("changes nothing for an item that already is the wanted one, whatever the decimals of its stored price", async () => {
        const { service, calls } = await build(stored())

        await expect(service.ensureItem("ws-1", ITEM)).resolves.toBe("kept")

        expect(calls).toEqual([])
    })

    it("brings a changed item back to the wanted name, unit and price, keeping its cost, stock rule, units and aliases", async () => {
        const { service, em } = await build(stored({ name: "Old", sellPriceVnd: "9000.00" }))

        await expect(service.ensureItem("ws-1", ITEM)).resolves.toBe("updated")

        expect(em.query).toHaveBeenCalledWith(SAVE_ITEM, [
            "ws-1",
            "item-1",
            "CHAU-MINI",
            "Mini pot",
            "pot",
            '[{"unit":"box","factor":10}]',
            "Hoa",
            "2000.00",
            5000,
            "3.000",
            "10.000",
            "supplier-1",
            ["chau"],
        ])
    })

    it("switches an item that was turned off back on", async () => {
        const { service, calls } = await build(stored({ active: false }))

        await expect(service.ensureItem("ws-1", ITEM)).resolves.toBe("updated")

        expect(calls).toEqual([SAVE_ITEM, SET_ITEM_ACTIVE])
    })

})

describe("InventorySeedService > photos", () => {
    it("writes the photo of a created item to the public product folder and points the item to it", async () => {
        const { service, em, upload } = await build(null)

        await expect(service.ensureItem("ws-1", { ...ITEM, image: PHOTO })).resolves.toBe("created")

        expect(upload).toHaveBeenCalledWith("media", PHOTO_PATH, PHOTO.bytes, "image/jpeg")
        expect(em.update).toHaveBeenCalledWith(
            InventoryItemEntity,
            { id: "item-1", workspaceId: "ws-1" },
            { imagePath: PHOTO_PATH, imageType: "image/jpeg" },
        )
    })

    it("keeps an item that holds the wanted photo, writing the photo again so a wiped store is filled", async () => {
        const { service, calls, upload } = await build(stored({ imagePath: PHOTO_PATH, imageType: "image/jpeg" }))

        await expect(service.ensureItem("ws-1", { ...ITEM, image: PHOTO })).resolves.toBe("kept")

        expect(calls).toEqual([])
        expect(upload).toHaveBeenCalledTimes(1)
    })

    it("gives an otherwise unchanged item its photo when it had none", async () => {
        const { service, em } = await build(stored({ imagePath: null, imageType: null }))

        await expect(service.ensureItem("ws-1", { ...ITEM, image: PHOTO })).resolves.toBe("updated")

        expect(em.update).toHaveBeenCalledWith(
            InventoryItemEntity,
            { id: "item-1", workspaceId: "ws-1" },
            { imagePath: PHOTO_PATH, imageType: "image/jpeg" },
        )
    })

    it("refuses a photo the store cannot take, one of a type no photo may have", async () => {
        const down = await build(null, "down")
        await expect(down.service.ensureItem("ws-1", { ...ITEM, image: PHOTO })).rejects.toThrow()
        const gif = await build(null)
        await expect(
            gif.service.ensureItem("ws-1", { ...ITEM, image: { ...PHOTO, contentType: "image/gif" } }),
        ).rejects.toThrow()
    })
})
