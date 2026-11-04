import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { inventoryItemOf } from "@tests/fixtures/builders/inventory.builder"
import { SAVE_ITEM, SET_ITEM_ACTIVE } from "@tests/fixtures/builders/inventory-calls.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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

const build = async (found: InventoryItemEntity | null) => {
    const em: MockEntityManager = mockEntityManager({
        findOne: [InventoryItemEntity, found],
        query: [SAVE_ITEM, [{ inventory_save_item: "item-1" }]],
    })
    const calls: Array<string> = []
    em.query.mockImplementation((statement: string) => {
        calls.push(statement)
        return Promise.resolve(statement === SET_ITEM_ACTIVE ? [] : [{ inventory_save_item: "item-1" }])
    })
    const moduleRef = await Test.createTestingModule({
        providers: [InventorySeedService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(InventorySeedService), em, calls }
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
