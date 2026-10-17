import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import { InventoryReplenishService } from "./inventory-replenish.service"
import { InventoryLogEvent } from "./inventory.log-events"
import {
    SELECT_ACTIVE_ITEMS,
    SELECT_ACTIVE_ITEMS_BY_ID,
    SELECT_DRAFT_PO,
    SELECT_ON_ORDER,
    SELECT_PO_ITEM_IDS,
    SELECT_PO_SUMMARY,
    SELECT_POS_WITH_SUPPLIER,
    SELECT_RULE_MODE,
} from "./persistence/inventory.sql"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const itemRow = (overrides: Record<string, unknown> = {}) => ({
    id: "item-1",
    sku: "TEA",
    name: "Tea",
    unit: "kg",
    units: [],
    category: "",
    cost_vnd: "6000",
    sell_price_vnd: null,
    reorder_point: "5.000",
    reorder_qty: "20.000",
    supplier_id: "sup-1",
    aliases: [],
    active: true,
    ...overrides,
})

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    const logger = mock<Logger>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const movements = mock<InventoryMovementsService>()
    movements.totals.mockResolvedValue(new Map([["item-1", 2]]))
    const orders = mock<InventoryOrdersService>()
    orders.leadTimeOf.mockResolvedValue(4)
    orders.createPoRecord.mockResolvedValue("po-1")
    const dispatch = mock<InventoryDispatchService>()
    dispatch.askToSend.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryReplenishService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InventoryMovementsService, useValue: movements },
            { provide: InventoryOrdersService, useValue: orders },
            { provide: InventoryDispatchService, useValue: dispatch },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryReplenishService), office, logger, members, movements, orders, dispatch }
}

describe("InventoryReplenishService / lowItems", () => {
    it("lists active low-stock items and skips items with no reorder point or enough stock", async () => {
        const em = mockEntityManager({
            query: [
                SELECT_ACTIVE_ITEMS,
                [
                    itemRow(),
                    itemRow({ id: "item-2", reorder_point: "0" }),
                    itemRow({ id: "item-3" }),
                    itemRow({ id: "item-4" }),
                ],
            ],
        })
        const { service, movements } = await build(em)
        movements.totals.mockResolvedValue(
            new Map([
                ["item-1", 2],
                ["item-2", 0],
                ["item-3", 50],
            ]),
        )

        const low = await service.lowItems("ws-1")

        expect(low.map((entry) => [entry.item.id, entry.total, entry.status])).toEqual([
            ["item-1", 2, "low"],
            ["item-4", 0, "out"],
        ])
        expect(movements.totals).toHaveBeenCalledWith("ws-1", ["item-1", "item-2", "item-3", "item-4"])
    })

    it("checks only the named items", async () => {
        const em = mockEntityManager({ query: [SELECT_ACTIVE_ITEMS_BY_ID, [itemRow()]] })
        const { service, movements } = await build(em)

        await expect(service.lowItems("ws-1", ["item-1"])).resolves.toHaveLength(1)

        expect(em.query).toHaveBeenCalledWith(SELECT_ACTIVE_ITEMS_BY_ID, ["ws-1", ["item-1"]])
        expect(movements.totals).toHaveBeenCalledWith("ws-1", ["item-1"])
    })
})

describe("InventoryReplenishService / draftLowStock", () => {
    it("drafts for a manager and counts the drafts and the low items", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow()]],
                [SELECT_RULE_MODE, []],
                [SELECT_ON_ORDER, []],
                [SELECT_DRAFT_PO, []],
                [SELECT_PO_SUMMARY, [{ po_no: "PO-1", total_vnd: "120000" }]],
                [SELECT_POS_WITH_SUPPLIER, [{ id: "po-1" }]],
            ],
        })
        const { service, members } = await build(em)

        await expect(service.draftLowStock("user-1", "ws-1")).resolves.toEqual({ drafted: 1, low: 1 })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
    })
})

describe("InventoryReplenishService / replenishJob", () => {
    it("checks the items a job payload names", async () => {
        const em = mockEntityManager({ query: [SELECT_ACTIVE_ITEMS_BY_ID, []] })
        const { service } = await build(em)

        await service.replenishJob({ workspaceId: "ws-1", itemIds: ["item-1"] })

        expect(em.query).toHaveBeenCalledWith(SELECT_ACTIVE_ITEMS_BY_ID, ["ws-1", ["item-1"]])
    })

    it("changes nothing for the payload of another job", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await service.replenishJob({ orderId: "order-1" })

        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("InventoryReplenishService / draftLow", () => {
    it("answers nothing when no item is low", async () => {
        const em = mockEntityManager({ query: [SELECT_ACTIVE_ITEMS, []] })
        const { service } = await build(em)

        await expect(service.draftLow("ws-1")).resolves.toEqual({ poIds: [], lowCount: 0, skipped: [] })
    })

    it("drafts nothing when the owner's rule forbids it", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow()]],
                [SELECT_RULE_MODE, [{ mode: "never" }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.draftLow("ws-1")).resolves.toEqual({ poIds: [], lowCount: 1, skipped: ["Tea"] })
    })

    it("leaves out an item an open order already covers", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow()]],
                [SELECT_RULE_MODE, [{ mode: "ask" }]],
                [SELECT_ON_ORDER, [{ item_id: "item-1", qty: "20.000" }]],
            ],
        })
        const { service, orders } = await build(em)

        await expect(service.draftLow("ws-1")).resolves.toEqual({ poIds: [], lowCount: 1, skipped: ["Tea"] })

        expect(orders.createPoRecord).not.toHaveBeenCalled()
    })
})

describe("InventoryReplenishService / draftLow", () => {
    it("creates one draft per supplier, logs it and asks the owner for the ones with a supplier", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_ACTIVE_ITEMS,
                    [itemRow(), itemRow({ id: "item-2", supplier_id: null, reorder_qty: "0", reorder_point: "4" })],
                ],
                [SELECT_RULE_MODE, []],
                [SELECT_ON_ORDER, []],
                [SELECT_DRAFT_PO, []],
                [SELECT_PO_SUMMARY, [{ po_no: "PO-1", total_vnd: "120000" }]],
                [SELECT_DRAFT_PO, []],
                [SELECT_PO_SUMMARY, []],
                [SELECT_POS_WITH_SUPPLIER, [{ id: "po-1" }]],
            ],
        })
        const { service, movements, orders, office, dispatch } = await build(em)
        movements.totals.mockResolvedValue(
            new Map([
                ["item-1", 2],
                ["item-2", 1],
            ]),
        )
        orders.createPoRecord.mockResolvedValueOnce("po-1").mockResolvedValueOnce("po-2")

        const outcome = await service.draftLow("ws-1", { by: "Lan" })

        expect(outcome).toEqual({ poIds: ["po-1", "po-2"], lowCount: 2, skipped: [] })
        expect(orders.createPoRecord).toHaveBeenNthCalledWith(1, "ws-1", {
            supplierId: "sup-1",
            lines: [{ itemId: "item-1", qty: 20, unitCost: 6000 }],
            by: "Lan",
            source: "auto",
            leadTimeDays: 4,
        })
        expect(orders.createPoRecord).toHaveBeenNthCalledWith(2, "ws-1", {
            supplierId: null,
            lines: [{ itemId: "item-2", qty: 7, unitCost: 6000 }],
            by: "Lan",
            source: "auto",
            leadTimeDays: 2,
        })
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "inventory.po_drafted",
            actor: text("inventory.draftActor"),
            summary: text("inventory.poDraftedSummary", { poNo: "PO-1", names: "Tea" }),
            evidence: expect.stringContaining("120.000"),
        })
        expect(office.logDecision).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                action: "draft_purchase_order",
                deciderKind: "policy",
                outcome: "auto_done",
            }),
        )
        expect(dispatch.askToSend).toHaveBeenCalledTimes(1)
        expect(dispatch.askToSend).toHaveBeenCalledWith("ws-1", "Lan", "po-1", "order")
    })
})

describe("InventoryReplenishService / draftLow", () => {
    it("extends the existing draft of the supplier with the items it lacks", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow(), itemRow({ id: "item-2" })]],
                [SELECT_RULE_MODE, []],
                [SELECT_ON_ORDER, []],
                [SELECT_DRAFT_PO, [{ id: "po-7" }]],
                [SELECT_PO_ITEM_IDS, [{ item_id: "item-1" }]],
                [SELECT_PO_SUMMARY, [{ po_no: "PO-7", total_vnd: "1" }]],
            ],
        })
        const { service, movements, orders } = await build(em)
        movements.totals.mockResolvedValue(new Map())

        const outcome = await service.draftLow("ws-1", { requestApproval: false })

        expect(outcome.poIds).toEqual(["po-7"])
        expect(orders.addLines).toHaveBeenCalledWith("ws-1", "po-7", [{ itemId: "item-2", qty: 20, unitCost: 6000 }])
        expect(orders.createPoRecord).not.toHaveBeenCalled()
    })

    it("adds nothing to an existing draft that already holds every low item", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow()]],
                [SELECT_RULE_MODE, []],
                [SELECT_ON_ORDER, []],
                [SELECT_DRAFT_PO, [{ id: "po-7" }]],
                [SELECT_PO_ITEM_IDS, [{ item_id: "item-1" }]],
                [SELECT_PO_SUMMARY, [{ po_no: "PO-7", total_vnd: "1" }]],
            ],
        })
        const { service, orders } = await build(em)

        await service.draftLow("ws-1", { requestApproval: false })

        expect(orders.addLines).not.toHaveBeenCalled()
    })
})

describe("InventoryReplenishService / requestApprovals", () => {
    it("does nothing for an empty list", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await service.requestApprovals("ws-1", "Lan", [])

        expect(em.query).not.toHaveBeenCalled()
    })

    it("logs a failure for one draft and goes on with the next", async () => {
        const em = mockEntityManager({ query: [SELECT_POS_WITH_SUPPLIER, [{ id: "po-1" }, { id: "po-2" }]] })
        const { service, dispatch, logger } = await build(em)
        const failure = new Error("gate down")
        dispatch.askToSend
            .mockRejectedValueOnce(failure)
            .mockResolvedValueOnce({ status: "waiting_decision", workItemId: "work-2" })

        await service.requestApprovals("ws-1", "Lan", ["po-1", "po-2", "po-3"])

        expect(logger.error).toHaveBeenCalledWith(InventoryLogEvent.RequestSendFailed, failure, { poId: "po-1" })
        expect(dispatch.askToSend).toHaveBeenCalledTimes(2)
    })
})
