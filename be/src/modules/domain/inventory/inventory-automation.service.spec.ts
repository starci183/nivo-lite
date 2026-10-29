import { Test } from "@nestjs/testing"
import { In, LessThan, MoreThanOrEqual } from "typeorm"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    inventoryItemOf,
    inventoryMovementOf,
    inventoryPurchaseOrderOf,
} from "@tests/fixtures/builders/inventory.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryAutomationService } from "./inventory-automation.service"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryReplenishService } from "./inventory-replenish.service"
import { InventoryItemEntity, InventoryMovementEntity, InventoryPurchaseOrderEntity } from "./persistence/entities"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const itemRow = (overrides: { [K in keyof InventoryItemEntity]?: InventoryItemEntity[K] } = {}): InventoryItemEntity =>
    inventoryItemOf({
        id: "item-1",
        sku: "TEA",
        name: "Tea",
        unit: "kg",
        units: [],
        category: "",
        costVnd: "1000",
        sellPriceVnd: null,
        reorderPoint: "5",
        reorderQty: "20",
        supplierId: null,
        aliases: [],
        active: true,
        ...overrides,
    })

const movementRow = (
    overrides: { [K in keyof InventoryMovementEntity]?: InventoryMovementEntity[K] } = {},
): InventoryMovementEntity => inventoryMovementOf(overrides)

const purchaseOrderRow = (
    overrides: { [K in keyof InventoryPurchaseOrderEntity]?: InventoryPurchaseOrderEntity[K] } = {},
): InventoryPurchaseOrderEntity => inventoryPurchaseOrderOf(overrides)

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const office = mock<OfficeLog>()
    office.workspaceName.mockResolvedValue("Quan Cafe")
    const mail = mock<OutboundMail>()
    const movements = mock<InventoryMovementsService>()
    movements.totals.mockResolvedValue(
        new Map([
            ["item-1", 2],
            ["item-2", 100],
        ]),
    )
    const replenish = mock<InventoryReplenishService>()
    const dispatch = mock<InventoryDispatchService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryAutomationService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: OutboundMail, useValue: mail },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T08:00:00.000Z") },
            { provide: InventoryMovementsService, useValue: movements },
            { provide: InventoryReplenishService, useValue: replenish },
            { provide: InventoryDispatchService, useValue: dispatch },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryAutomationService), office, mail, movements, replenish, dispatch }
}

describe("InventoryAutomationService / runLowStock", () => {
    it("drafts, says so in the Office and asks the owner to approve each draft", async () => {
        const { service, replenish, office } = await build(mockEntityManager())
        replenish.draftLow.mockResolvedValue({ poIds: ["po-1", "po-2"], lowCount: 3, skipped: [] })

        const outcome = await service.runLowStock("ws-1", "NIVO")

        expect(outcome.poIds).toEqual(["po-1", "po-2"])
        expect(replenish.draftLow).toHaveBeenCalledWith("ws-1", { by: "NIVO", requestApproval: false })
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", text("inventory.lowStockNote", { low: 3, orders: 2 }))
        expect(replenish.requestApprovals).toHaveBeenCalledWith("ws-1", "NIVO", ["po-1", "po-2"])
    })

    it("says nothing when nothing was drafted", async () => {
        const { service, replenish, office } = await build(mockEntityManager())
        replenish.draftLow.mockResolvedValue({ poIds: [], lowCount: 0, skipped: [] })

        await service.runLowStock("ws-1", "NIVO")

        expect(office.postOffice).not.toHaveBeenCalled()
        expect(replenish.requestApprovals).not.toHaveBeenCalled()
    })
})

/** A week of movements: goods out and in at the item's cost and at their own, an adjustment, and a ghost item. */
const WEEK_MOVES = [
    movementRow({ kind: "out", qty: "-3.000", itemId: "item-1" }),
    movementRow({ kind: "in", qty: "10.000", unitCostVnd: "1200", itemId: "item-1" }),
    movementRow({ kind: "in", qty: "4", itemId: "item-1" }),
    movementRow({ kind: "adjust", qty: "1", itemId: "item-1" }),
    movementRow({ kind: "out", qty: "-1", itemId: "ghost" }),
    movementRow({ kind: "in", qty: "1", itemId: "ghost" }),
]

describe("InventoryAutomationService / runWeeklyReport", () => {
    it("posts the report with the stock value, the week's flow, the low items and the open orders, and mails it", async () => {
        const em = mockEntityManager({
            find: [
                [
                    InventoryItemEntity,
                    [itemRow(), itemRow({ id: "item-2", name: "Sugar", reorderPoint: "0", costVnd: "0" })],
                ],
                [InventoryMovementEntity, WEEK_MOVES],
            ],
        })
        const [openOrders] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { po_no: "PO-1", status: "sent", total_vnd: "50000", supplier_name: "Mill Co" },
                    { po_no: "PO-2", status: "draft", total_vnd: "0", supplier_name: null },
                ],
            },
        ])
        const { service, office, mail } = await build(em)
        mail.send.mockResolvedValue({ status: "sent" })

        const report = await service.runWeeklyReport("ws-1", "owner@shop.vn")

        expect(report).toMatchObject({ lowCount: 1, openOrders: 2, email: "sent", valueVnd: 2000 })
        expect(em.find).toHaveBeenCalledWith(InventoryItemEntity, {
            where: { workspaceId: "ws-1", active: true },
            order: { name: "ASC" },
            take: 2000,
        })
        expect(em.find).toHaveBeenCalledWith(InventoryMovementEntity, {
            select: { kind: true, qty: true, unitCostVnd: true, itemId: true },
            where: { workspaceId: "ws-1", createdAt: MoreThanOrEqual(new Date("2026-10-05T08:00:00.000Z")) },
            take: 20000,
        })
        expect(openOrders?.callsOf("where")).toEqual([
            [
                "po.workspace_id = :workspaceId AND po.status IN (:...open)",
                { workspaceId: "ws-1", open: ["draft", "waiting_approval", "sent", "partially_received"] },
            ],
        ])
        expect(openOrders?.callsOf("limit")).toEqual([[500]])
        expect(report.text).toContain(text("inventory.reportTitle", { shop: "Quan Cafe" }))
        expect(report.text).toContain("inventory.reportLowItem")
        expect(report.text).toContain(text("inventory.reportNoSupplier"))
        expect(report.text).toContain(text("inventory.poStatus.sent"))
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", report.text)
        expect(mail.send).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            to: "owner@shop.vn",
            subject: text("inventory.reportSubject", { shop: "Quan Cafe" }),
            title: text("inventory.reportMailTitle"),
            body: report.text,
            purpose: "inventory_weekly_report",
            audience: "owner",
        })
    })

    it("reports a calm week without mailing when no address is given", async () => {
        const em = mockEntityManager({
            find: [
                [InventoryItemEntity, [itemRow({ id: "item-2" })]],
                [InventoryMovementEntity, []],
            ],
        })
        queueQueryBuilders(em, [{ getRawMany: [] }])
        const { service, mail } = await build(em)

        const report = await service.runWeeklyReport("ws-1", "")

        expect(report).toMatchObject({ lowCount: 0, openOrders: 0, email: "none", valueVnd: 100000 })
        expect(report.text).toContain(text("inventory.reportNoLow"))
        expect(report.text).toContain(text("inventory.reportNoOrders"))
        expect(mail.send).not.toHaveBeenCalled()
    })
})

describe("InventoryAutomationService / runWeeklyReport", () => {
    it("records a mail that did not go out", async () => {
        const em = mockEntityManager({
            find: [
                [InventoryItemEntity, []],
                [InventoryMovementEntity, []],
            ],
        })
        queueQueryBuilders(em, [{ getRawMany: [] }])
        const { service, mail } = await build(em)
        mail.send.mockResolvedValue({ status: "failed", error: "smtp" })

        await expect(service.runWeeklyReport("ws-1", "owner@shop.vn")).resolves.toMatchObject({ email: "failed" })
    })

    it("lists at most eight low items and six orders by name", async () => {
        const rows = Array.from({ length: 9 }, (_unused, index) => itemRow({ id: `low-${index}` }))
        const orders = Array.from({ length: 7 }, (_unused, index) => ({
            po_no: `PO-${index}`,
            status: "sent",
            total_vnd: "1",
            supplier_name: "A",
        }))
        const em = mockEntityManager({
            find: [
                [InventoryItemEntity, rows],
                [InventoryMovementEntity, []],
            ],
        })
        queueQueryBuilders(em, [{ getRawMany: orders }])
        const { service, movements } = await build(em)
        movements.totals.mockResolvedValue(new Map())

        const report = await service.runWeeklyReport("ws-1", "")

        expect(report.text.match(/inventory\.reportLowItem/gu)).toHaveLength(8)
        expect(report.text.match(/inventory\.reportOrderItem/gu)).toHaveLength(6)
    })
})

/** The find options the overdue read must send for a cutoff day: sent orders under two reminders, the last one two days ago. */
const overdueQuery = (cutoffDay: string) => {
    const sent = In(["sent", "partially_received"])
    return {
        select: { id: true },
        where: [
            { workspaceId: "ws-1", status: sent, expectedAt: LessThan(cutoffDay), reminders: 0 },
            {
                workspaceId: "ws-1",
                status: sent,
                expectedAt: LessThan(cutoffDay),
                reminders: LessThan(2),
                updatedAt: LessThan(new Date("2026-10-10T08:00:00.000Z")),
            },
        ],
        take: 20,
    }
}

describe("InventoryAutomationService / overdueOrderIds", () => {
    it("reads the sent orders past their due day after the grace days", async () => {
        const em = mockEntityManager({
            find: [InventoryPurchaseOrderEntity, [purchaseOrderRow({ id: "po-1" }), purchaseOrderRow({ id: "po-2" })]],
        })
        const { service } = await build(em)

        await expect(service.overdueOrderIds("ws-1", 2)).resolves.toEqual(["po-1", "po-2"])

        expect(em.find).toHaveBeenCalledWith(InventoryPurchaseOrderEntity, overdueQuery("2026-10-10"))
    })

    it("never reads a negative grace as a future day", async () => {
        const em = mockEntityManager({ find: [InventoryPurchaseOrderEntity, []] })
        const { service } = await build(em)

        await service.overdueOrderIds("ws-1", -5)

        expect(em.find).toHaveBeenCalledWith(InventoryPurchaseOrderEntity, overdueQuery("2026-10-12"))
    })
})

describe("InventoryAutomationService / remindOverdue", () => {
    const reminderRow = {
        id: "po-1",
        po_no: "PO-1",
        status: "sent",
        reminders: 1,
        expected_at: "2026-10-01",
        supplier_name: "Mill Co",
    }
    it("writes the Office line and asks the owner to approve the reminder", async () => {
        const em = mockEntityManager()
        const [reminder] = queueQueryBuilders(em, [{ getRawOne: reminderRow }])
        const { service, office, dispatch } = await build(em)
        dispatch.askToSend.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })

        await expect(service.remindOverdue("ws-1", "po-1")).resolves.toEqual({
            state: "asked",
            workItemId: "work-1",
            reminder: 2,
            poNo: "PO-1",
        })

        expect(office.postOffice).toHaveBeenCalledWith(
            "ws-1",
            text("inventory.overdueNote", {
                poNo: "PO-1",
                who: "Mill Co",
                due: text("inventory.overdueDue", { date: "01/10/2026" }),
            }),
        )
        expect(dispatch.askToSend).toHaveBeenCalledWith("ws-1", "NIVO", "po-1", "reminder")
        expect(reminder?.callsOf("where")).toEqual([
            ["po.workspace_id = :workspaceId AND po.id = :poId", { workspaceId: "ws-1", poId: "po-1" }],
        ])
        expect(reminder?.callsOf("addSelect")).toContainEqual(["to_char(po.expected_at, 'YYYY-MM-DD')", "expected_at"])
    })

    it("answers sent when the gate let the reminder through, and names a missing supplier and day", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [
            { getRawOne: { ...reminderRow, status: "partially_received", expected_at: null, supplier_name: null } },
        ])
        const { service, office, dispatch } = await build(em)
        dispatch.askToSend.mockResolvedValue({ status: "done", workItemId: "work-1" })

        await expect(service.remindOverdue("ws-1", "po-1")).resolves.toMatchObject({ state: "sent" })

        expect(office.postOffice).toHaveBeenCalledWith(
            "ws-1",
            text("inventory.overdueNote", { poNo: "PO-1", who: text("inventory.supplierFallback"), due: "" }),
        )
    })

    it("skips an order that is gone or no longer waiting for goods", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawOne: undefined }, { getRawOne: { ...reminderRow, status: "received" } }])
        const { service, dispatch } = await build(em)

        await expect(service.remindOverdue("ws-1", "po-9")).resolves.toEqual({
            state: "skipped",
            workItemId: null,
            reminder: 0,
            poNo: "",
        })
        await expect(service.remindOverdue("ws-1", "po-1")).resolves.toEqual({
            state: "skipped",
            workItemId: null,
            reminder: 0,
            poNo: "PO-1",
        })

        expect(dispatch.askToSend).not.toHaveBeenCalled()
    })
})
