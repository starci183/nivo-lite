import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { inventoryItemOf, inventoryRecipeLineOf, inventoryRecipeOf } from "@tests/fixtures/builders/inventory.builder"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { INBOX } from "@modules/platform/inbox"
import { InventoryDeductionService } from "./inventory-deduction.service"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryItemEntity, InventoryRecipeEntity, InventoryRecipeLineEntity } from "./persistence/entities"

const LINE_BREAK = "\n"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const itemRow = (overrides: { [K in keyof InventoryItemEntity]?: InventoryItemEntity[K] } = {}): InventoryItemEntity =>
    inventoryItemOf({
        id: "item-1",
        sku: "TEA",
        name: "Tea",
        unit: "kg",
        units: [{ unit: "box", factor: 10 }],
        category: "",
        costVnd: "20000.00",
        sellPriceVnd: null,
        reorderPoint: "0",
        reorderQty: "0",
        supplierId: null,
        aliases: [],
        active: true,
        ...overrides,
    })

const recipeRow = (
    overrides: { [K in keyof InventoryRecipeEntity]?: InventoryRecipeEntity[K] } = {},
): InventoryRecipeEntity => inventoryRecipeOf(overrides)

const recipeLineRow = (
    overrides: { [K in keyof InventoryRecipeLineEntity]?: InventoryRecipeLineEntity[K] } = {},
): InventoryRecipeLineEntity => inventoryRecipeLineOf(overrides)

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    const inbox = fakeInbox()
    const movements = mock<InventoryMovementsService>()
    movements.apply.mockResolvedValue({ applied: true, before: 10, after: 12, cost: 20000 })
    const locations = mock<InventoryLocationsService>()
    locations.defaultLocation.mockResolvedValue("loc-1")
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryDeductionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: InventoryMovementsService, useValue: movements },
            { provide: InventoryLocationsService, useValue: locations },
            { provide: INBOX, useValue: inbox },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryDeductionService), office, inbox, movements, locations }
}

describe("InventoryDeductionService / deductConfirmedOrder", () => {
    const QUEUE = "order_confirmed__inventory"
    const confirmed = { workspaceId: "ws-1", orderId: "order-1", orderNo: "DH-1", items: "2 tea" }

    it("claims the delivery key and deducts the confirmed order in one transaction", async () => {
        const tx = fakeTransaction(mockEntityManager({ find: [InventoryItemEntity, []] }))
        const { service, inbox } = await build(tx.em)

        await service.deductConfirmedOrder(QUEUE, "order-1", confirmed)

        expect(inbox.claims).toEqual([{ source: QUEUE, eventId: "order-1" }])
        expect(tx.em.find).toHaveBeenCalledWith(InventoryItemEntity, {
            where: { workspaceId: "ws-1", active: true },
            order: { name: "ASC" },
            take: 2000,
        })
        expect(tx.commits).toBe(1)
    })

    it("deducts nothing for a delivery key it already handled", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { service, inbox } = await build(tx.em)
        inbox.seen(QUEUE, "order-1")

        await service.deductConfirmedOrder(QUEUE, "order-1", confirmed)

        expect(tx.em.find).not.toHaveBeenCalled()
    })

    it("rolls the claim back when the deduction fails so the redelivery runs again", async () => {
        const failure = new Error("stock down")
        const tx = fakeTransaction(mockEntityManager())
        tx.em.find.mockRejectedValue(failure)
        const { service } = await build(tx.em)

        await expect(service.deductConfirmedOrder(QUEUE, "order-1", confirmed)).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
    })
})

describe("InventoryDeductionService / deductForOrder", () => {
    const order = {
        workspaceId: "ws-1",
        orderId: "order-1",
        orderNo: "DH-1",
        items: ["2 tea", "1 milk coffee", "3 ghost", "1 water", "1 air"].join(LINE_BREAK),
    }
    it("does nothing for an order without an id or without text, and for a workspace without items", async () => {
        const em = mockEntityManager({ find: [InventoryItemEntity, []] })
        const { service, movements } = await build(em)

        await expect(service.deductForOrder({ ...order, orderId: "" })).resolves.toEqual({
            deducted: [],
            unmatched: [],
        })
        await expect(service.deductForOrder({ ...order, items: "  " })).resolves.toEqual({
            deducted: [],
            unmatched: [],
        })
        await expect(service.deductForOrder(order)).resolves.toEqual({ deducted: [], unmatched: [] })

        expect(movements.apply).not.toHaveBeenCalled()
    })
})

describe("InventoryDeductionService / deductForOrder", () => {
    const order = {
        workspaceId: "ws-1",
        orderId: "order-1",
        orderNo: "DH-1",
        items: ["2 tea", "1 milk coffee", "3 ghost", "1 water", "1 air"].join(LINE_BREAK),
    }
    it("takes items and recipe ingredients out of stock, reports unmatched lines and queues the check", async () => {
        const em = mockEntityManager({
            find: [
                [
                    InventoryItemEntity,
                    [itemRow(), itemRow({ id: "item-2", sku: "MILK", name: "Milk", unit: "l", units: [] })],
                ],
                [
                    InventoryRecipeEntity,
                    [
                        recipeRow({ id: "rec-1", name: "Milk coffee" }),
                        recipeRow({ id: "rec-2", name: "Water" }),
                        recipeRow({ id: "rec-3", name: "Air" }),
                    ],
                ],
                [
                    InventoryRecipeLineEntity,
                    [
                        recipeLineRow({ recipeId: "rec-1", itemId: "item-2", qty: "0.250" }),
                        recipeLineRow({ recipeId: "rec-1", itemId: "item-1", qty: "0.020" }),
                        recipeLineRow({ recipeId: "rec-2", itemId: "item-gone", qty: "1" }),
                    ],
                ],
            ],
        })
        const { service, movements, office } = await build(em)
        movements.apply
            .mockResolvedValueOnce({ applied: true, before: 10, after: 7.98, cost: 0 })
            .mockResolvedValueOnce({ applied: false, before: 0, after: 0, cost: 0 })

        const result = await service.deductForOrder(order)

        expect(result.unmatched).toEqual(["3 ghost"])
        expect(result.deducted).toEqual([{ itemId: "item-1", name: "Tea", qty: 2.02, unit: "kg", after: 7.98 }])
        expect(movements.apply).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                itemId: "item-1",
                kind: "out",
                delta: -2.02,
                refType: "order",
                refId: "order-1",
                refLabel: "DH-1",
                by: "NIVO",
                dedupe: "order:order-1:item-1",
            }),
        )
        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ kind: "inventory.order_deducted", actor: text("inventory.actorName") }),
        )
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", expect.stringContaining("inventory.orderUnmatchedNote"))
        expect(movements.replenishLater).toHaveBeenCalledWith("ws-1", ["item-1"])
    })
})

describe("InventoryDeductionService / deductForOrder", () => {
    const order = {
        workspaceId: "ws-1",
        orderId: "order-1",
        orderNo: "DH-1",
        items: ["2 tea", "1 milk coffee", "3 ghost", "1 water", "1 air"].join(LINE_BREAK),
    }
    it("retries the whole line after a stripped-name miss and skips inactive items", async () => {
        const em = mockEntityManager({
            find: [
                [InventoryItemEntity, [itemRow({ name: "Soda", sku: "SD", aliases: ["2 up"] })]],
                [InventoryRecipeEntity, []],
                [InventoryRecipeLineEntity, [recipeLineRow({ recipeId: "rec-9", itemId: "item-gone", qty: "1" })]],
            ],
        })
        const { service, movements } = await build(em)

        const result = await service.deductForOrder({ ...order, items: "2 up" })

        expect(result.unmatched).toEqual([])
        expect(movements.apply).toHaveBeenCalledWith("ws-1", expect.objectContaining({ itemId: "item-1", delta: -1 }))
    })

    it("does not log anything when no line matched anything", async () => {
        const em = mockEntityManager({
            find: [
                [InventoryItemEntity, [itemRow()]],
                [InventoryRecipeEntity, []],
                [InventoryRecipeLineEntity, []],
            ],
        })
        const { service, office, movements } = await build(em)

        await service.deductForOrder({ ...order, items: "zzz" })

        expect(office.logEvidence).not.toHaveBeenCalled()
        expect(movements.replenishLater).toHaveBeenCalledWith("ws-1", [])
    })
})
