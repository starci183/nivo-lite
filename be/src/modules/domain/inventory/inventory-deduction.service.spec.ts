import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryOrderQueue } from "@modules/queues/inventory-order"
import { InventoryDeductionService } from "./inventory-deduction.service"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { SELECT_ACTIVE_ITEMS, SELECT_ACTIVE_RECIPES, SELECT_RECIPE_LINES } from "./persistence/inventory.sql"

const LINE_BREAK = "\n"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const itemRow = (overrides: Record<string, unknown> = {}) => ({
    id: "item-1",
    sku: "TEA",
    name: "Tea",
    unit: "kg",
    units: [{ unit: "box", factor: 10 }],
    category: "",
    cost_vnd: "20000.00",
    sell_price_vnd: null,
    reorder_point: "0",
    reorder_qty: "0",
    supplier_id: null,
    aliases: [],
    active: true,
    ...overrides,
})

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "staff",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const movements = mock<InventoryMovementsService>()
    movements.apply.mockResolvedValue({ applied: true, before: 10, after: 12, cost: 20000 })
    const locations = mock<InventoryLocationsService>()
    locations.defaultLocation.mockResolvedValue("loc-1")
    const queue = mock<InventoryOrderQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryDeductionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InventoryMovementsService, useValue: movements },
            { provide: InventoryLocationsService, useValue: locations },
            { provide: InventoryOrderQueue, useValue: queue },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryDeductionService), office, members, movements, locations, queue }
}

describe("InventoryDeductionService / enqueueDeduct", () => {
    it("queues the deduction in one transaction after proving membership", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const { service, queue, members } = await build(tx.em)

        await service.enqueueDeduct("user-1", "ws-1", { orderId: "order-1", orderNo: "DH-1", items: "2 tea" })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", [])
        expect(queue.enqueueDeductOrder).toHaveBeenCalledWith(
            { workspaceId: "ws-1", orderId: "order-1", orderNo: "DH-1", items: "2 tea" },
            expect.anything(),
        )
        expect(tx.commits).toBe(1)
    })
})

describe("InventoryDeductionService / deductOrderJob", () => {
    it("deducts a job payload that names an order", async () => {
        const em = mockEntityManager({ query: [SELECT_ACTIVE_ITEMS, []] })
        const { service } = await build(em)

        await service.deductOrderJob({ workspaceId: "ws-1", orderId: "order-1", orderNo: "DH-1", items: "2 tea" })

        expect(em.query).toHaveBeenCalledWith(SELECT_ACTIVE_ITEMS, ["ws-1"])
    })

    it("changes nothing for the payload of another job", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await service.deductOrderJob({ itemIds: [] })

        expect(em.query).not.toHaveBeenCalled()
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
        const em = mockEntityManager({ query: [SELECT_ACTIVE_ITEMS, []] })
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
            query: [
                [
                    SELECT_ACTIVE_ITEMS,
                    [itemRow(), itemRow({ id: "item-2", sku: "MILK", name: "Milk", unit: "l", units: [] })],
                ],
                [
                    SELECT_ACTIVE_RECIPES,
                    [
                        { id: "rec-1", name: "Milk coffee", aliases: [] },
                        { id: "rec-2", name: "Water", aliases: [] },
                        { id: "rec-3", name: "Air", aliases: [] },
                    ],
                ],
                [
                    SELECT_RECIPE_LINES,
                    [
                        { recipe_id: "rec-1", item_id: "item-2", qty: "0.250" },
                        { recipe_id: "rec-1", item_id: "item-1", qty: "0.020" },
                        { recipe_id: "rec-2", item_id: "item-gone", qty: "1" },
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
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow({ name: "Soda", sku: "SD", aliases: ["2 up"] })]],
                [SELECT_ACTIVE_RECIPES, []],
                [SELECT_RECIPE_LINES, [{ recipe_id: "rec-9", item_id: "item-gone", qty: "1" }]],
            ],
        })
        const { service, movements } = await build(em)

        const result = await service.deductForOrder({ ...order, items: "2 up" })

        expect(result.unmatched).toEqual([])
        expect(movements.apply).toHaveBeenCalledWith("ws-1", expect.objectContaining({ itemId: "item-1", delta: -1 }))
    })

    it("does not log anything when no line matched anything", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow()]],
                [SELECT_ACTIVE_RECIPES, []],
                [SELECT_RECIPE_LINES, []],
            ],
        })
        const { service, office, movements } = await build(em)

        await service.deductForOrder({ ...order, items: "zzz" })

        expect(office.logEvidence).not.toHaveBeenCalled()
        expect(movements.replenishLater).toHaveBeenCalledWith("ws-1", [])
    })
})
