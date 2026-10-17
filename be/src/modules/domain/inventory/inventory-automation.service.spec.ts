import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryAutomationService } from "./inventory-automation.service"
import { InventoryDispatchService } from "./inventory-dispatch.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryReplenishService } from "./inventory-replenish.service"
import {
    SELECT_ACTIVE_ITEMS,
    SELECT_MOVEMENTS_SINCE,
    SELECT_OPEN_POS,
    SELECT_OVERDUE_POS,
    SELECT_PO_FOR_REMINDER,
} from "./persistence/inventory.sql"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const itemRow = (overrides: Record<string, unknown> = {}) => ({
    id: "item-1",
    sku: "TEA",
    name: "Tea",
    unit: "kg",
    units: [],
    category: "",
    cost_vnd: "1000",
    sell_price_vnd: null,
    reorder_point: "5",
    reorder_qty: "20",
    supplier_id: null,
    aliases: [],
    active: true,
    ...overrides,
})

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

describe("InventoryAutomationService / runWeeklyReport", () => {
    it("posts the report with the stock value, the week's flow, the low items and the open orders, and mails it", async () => {
        const em = mockEntityManager({
            query: [
                [
                    SELECT_ACTIVE_ITEMS,
                    [itemRow(), itemRow({ id: "item-2", name: "Sugar", reorder_point: "0", cost_vnd: "0" })],
                ],
                [
                    SELECT_MOVEMENTS_SINCE,
                    [
                        { kind: "out", qty: "-3.000", unit_cost_vnd: null, item_id: "item-1" },
                        { kind: "in", qty: "10.000", unit_cost_vnd: "1200", item_id: "item-1" },
                        { kind: "in", qty: "4", unit_cost_vnd: null, item_id: "item-1" },
                        { kind: "adjust", qty: "1", unit_cost_vnd: null, item_id: "item-1" },
                        { kind: "out", qty: "-1", unit_cost_vnd: null, item_id: "ghost" },
                        { kind: "in", qty: "1", unit_cost_vnd: null, item_id: "ghost" },
                    ],
                ],
                [
                    SELECT_OPEN_POS,
                    [
                        { po_no: "PO-1", status: "sent", total_vnd: "50000", supplier_name: "Mill Co" },
                        { po_no: "PO-2", status: "draft", total_vnd: "0", supplier_name: null },
                    ],
                ],
            ],
        })
        const { service, office, mail } = await build(em)
        mail.send.mockResolvedValue({ status: "sent" })

        const report = await service.runWeeklyReport("ws-1", "owner@shop.vn")

        expect(report).toMatchObject({ lowCount: 1, openOrders: 2, email: "sent", valueVnd: 2000 })
        expect(em.query).toHaveBeenCalledWith(SELECT_MOVEMENTS_SINCE, ["ws-1", "2026-10-05T08:00:00.000Z"])
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
            query: [
                [SELECT_ACTIVE_ITEMS, [itemRow({ id: "item-2" })]],
                [SELECT_MOVEMENTS_SINCE, []],
                [SELECT_OPEN_POS, []],
            ],
        })
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
            query: [
                [SELECT_ACTIVE_ITEMS, []],
                [SELECT_MOVEMENTS_SINCE, []],
                [SELECT_OPEN_POS, []],
            ],
        })
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
            query: [
                [SELECT_ACTIVE_ITEMS, rows],
                [SELECT_MOVEMENTS_SINCE, []],
                [SELECT_OPEN_POS, orders],
            ],
        })
        const { service, movements } = await build(em)
        movements.totals.mockResolvedValue(new Map())

        const report = await service.runWeeklyReport("ws-1", "")

        expect(report.text.match(/inventory\.reportLowItem/gu)).toHaveLength(8)
        expect(report.text.match(/inventory\.reportOrderItem/gu)).toHaveLength(6)
    })
})

describe("InventoryAutomationService / overdueOrderIds", () => {
    it("reads the sent orders past their due day after the grace days", async () => {
        const em = mockEntityManager({ query: [SELECT_OVERDUE_POS, [{ id: "po-1" }, { id: "po-2" }]] })
        const { service } = await build(em)

        await expect(service.overdueOrderIds("ws-1", 2)).resolves.toEqual(["po-1", "po-2"])

        expect(em.query).toHaveBeenCalledWith(SELECT_OVERDUE_POS, ["ws-1", "2026-10-10", "2026-10-10T08:00:00.000Z"])
    })

    it("never reads a negative grace as a future day", async () => {
        const em = mockEntityManager({ query: [SELECT_OVERDUE_POS, []] })
        const { service } = await build(em)

        await service.overdueOrderIds("ws-1", -5)

        expect(em.query).toHaveBeenCalledWith(SELECT_OVERDUE_POS, ["ws-1", "2026-10-12", "2026-10-10T08:00:00.000Z"])
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
        const em = mockEntityManager({ query: [SELECT_PO_FOR_REMINDER, [reminderRow]] })
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
    })

    it("answers sent when the gate let the reminder through, and names a missing supplier and day", async () => {
        const em = mockEntityManager({
            query: [
                SELECT_PO_FOR_REMINDER,
                [{ ...reminderRow, status: "partially_received", expected_at: null, supplier_name: null }],
            ],
        })
        const { service, office, dispatch } = await build(em)
        dispatch.askToSend.mockResolvedValue({ status: "done", workItemId: "work-1" })

        await expect(service.remindOverdue("ws-1", "po-1")).resolves.toMatchObject({ state: "sent" })

        expect(office.postOffice).toHaveBeenCalledWith(
            "ws-1",
            text("inventory.overdueNote", { poNo: "PO-1", who: text("inventory.supplierFallback"), due: "" }),
        )
    })

    it("skips an order that is gone or no longer waiting for goods", async () => {
        const em = mockEntityManager({
            query: [
                [SELECT_PO_FOR_REMINDER, []],
                [SELECT_PO_FOR_REMINDER, [{ ...reminderRow, status: "received" }]],
            ],
        })
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
