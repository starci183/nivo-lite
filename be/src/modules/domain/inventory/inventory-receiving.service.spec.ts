import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InventoryErrorCode } from "./errors/inventory.error"
import type { LoadedPo } from "./inventory.contracts"
import { InventoryLocationsService } from "./inventory-locations.service"
import { InventoryMovementsService } from "./inventory-movements.service"
import { InventoryOrdersService } from "./inventory-orders.service"
import { InventoryReceivingService } from "./inventory-receiving.service"
import {
    CLOSE_RECEIPT,
    DISCARD_RECEIPT,
    OPEN_RECEIPT,
    RECEIVE_PO_LINE,
    RECOMPUTE_PO_TOTAL,
    SELECT_ACCOUNTING_INSTALLED,
    SET_PO_STATUS,
} from "./persistence/inventory.sql"

const UUID = "0b8c1f0e-3a49-4b7e-9d3f-2c1f6a5d7e90"
const UUID_2 = "1c9d2a1f-4b5a-4c8f-8e4a-3d2a7b6e8fa1"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const poOf = (overrides: Partial<LoadedPo> = {}): LoadedPo => ({
    id: "po-1",
    poNo: "PO-202610-0001",
    supplierId: "sup-1",
    status: "sent",
    totalVnd: 0,
    expectedAt: null,
    message: "",
    reminders: 0,
    supplier: { name: "Mill Co", contactName: "", email: null, channel: "email", leadTimeDays: 2 },
    lines: [
        { id: UUID, itemId: "item-1", qtyOrdered: 10, qtyReceived: 0, unitCost: 6000, itemName: "Tea", itemUnit: "kg" },
        { id: UUID_2, itemId: "item-2", qtyOrdered: 5, qtyReceived: 0, unitCost: 100, itemName: null, itemUnit: null },
    ],
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
        role: "manager",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const movements = mock<InventoryMovementsService>()
    movements.apply.mockResolvedValue({ applied: true, before: 0, after: 1, cost: 0 })
    const locations = mock<InventoryLocationsService>()
    locations.defaultLocation.mockResolvedValue("loc-1")
    const orders = mock<InventoryOrdersService>()
    orders.loadPo.mockResolvedValue(poOf())
    const moduleRef = await Test.createTestingModule({
        providers: [
            InventoryReceivingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: OfficeLog, useValue: office },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InventoryMovementsService, useValue: movements },
            { provide: InventoryLocationsService, useValue: locations },
            { provide: InventoryOrdersService, useValue: orders },
        ],
    }).compile()
    return { service: moduleRef.get(InventoryReceivingService), office, movements, orders }
}

describe("InventoryReceivingService / receivePo", () => {
    it("receives at actual prices, completes the order, logs changes and hands the payable to Accounting", async () => {
        const em = mockEntityManager({
            query: [
                [OPEN_RECEIPT, [{ id: "rec-1" }]],
                [RECEIVE_PO_LINE, []],
                [RECEIVE_PO_LINE, []],
                [CLOSE_RECEIPT, []],
                [SET_PO_STATUS, []],
                [RECOMPUTE_PO_TOTAL, [{ total: "1" }]],
                [SELECT_ACCOUNTING_INSTALLED, [{ id: "mod-1" }]],
            ],
        })
        const { service, movements, orders, office } = await build(em)
        orders.loadPo
            .mockResolvedValueOnce(poOf())
            .mockResolvedValueOnce(
                poOf({ lines: poOf().lines.map((line) => ({ ...line, qtyReceived: line.qtyOrdered })) }),
            )

        const result = await service.receivePo("user-1", "ws-1", {
            poId: "po-1",
            invoiceNo: " INV-9 ",
            note: "ok",
            lines: [
                { lineId: UUID, qty: "10", unitCost: "6.500" },
                { lineId: UUID_2, qty: "5", unitCost: "" },
            ],
        })

        expect(result).toEqual({
            status: "received",
            received: 2,
            priceChanges: [expect.stringContaining("inventory.priceChange")],
            payableVnd: 65500,
            handedToAccounting: true,
        })
        expect(em.query).toHaveBeenCalledWith(OPEN_RECEIPT, ["ws-1", "po-1", "INV-9", "ok", "Lan"])
        expect(movements.apply).toHaveBeenCalledWith("ws-1", {
            itemId: "item-1",
            locationId: "loc-1",
            kind: "in",
            delta: 10,
            reason: text("inventory.receiveReason", { poNo: "PO-202610-0001" }),
            refType: "po",
            refId: "po-1",
            refLabel: "PO-202610-0001",
            by: "Lan",
            evidence: text("inventory.invoiceEvidence", { invoiceNo: "INV-9" }),
            dedupe: `po-receive:rec-1:${UUID}`,
            unitCost: 6500,
        })
        expect(em.query).toHaveBeenCalledWith(RECEIVE_PO_LINE, [UUID, 10, 6500])
        expect(em.query).toHaveBeenCalledWith(RECEIVE_PO_LINE, [UUID_2, 5, 100])
        expect(em.query).toHaveBeenCalledWith(CLOSE_RECEIPT, ["rec-1", 65500])
        expect(em.query).toHaveBeenCalledWith(SET_PO_STATUS, ["po-1", "received"])
        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                kind: "inventory.received",
                summary: expect.stringContaining("inventory.receivedFullSummary"),
            }),
        )
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", expect.stringContaining("inventory.priceChangeNote"))
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", expect.stringContaining("inventory.payableNote"))
        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ kind: "inventory.payable", actor: text("inventory.receiveActor") }),
        )
        expect(movements.replenishLater).toHaveBeenCalledWith("ws-1", ["item-1", "item-2"])
    })
})

describe("InventoryReceivingService / receivePo", () => {
    it("marks partial receipts, skips unapplied lines and requires Accounting and an invoice", async () => {
        const em = mockEntityManager({
            query: [
                [OPEN_RECEIPT, [{ id: "rec-1" }]],
                [RECEIVE_PO_LINE, []],
                [CLOSE_RECEIPT, []],
                [SET_PO_STATUS, []],
                [RECOMPUTE_PO_TOTAL, [{ total: "1" }]],
                [SELECT_ACCOUNTING_INSTALLED, []],
            ],
        })
        const { service, movements, orders, office } = await build(em)
        movements.apply
            .mockResolvedValueOnce({ applied: true, before: 0, after: 4, cost: 0 })
            .mockResolvedValueOnce({ applied: false, before: 0, after: 0, cost: 0 })
        orders.loadPo
            .mockResolvedValueOnce(poOf())
            .mockResolvedValueOnce(poOf({ lines: poOf().lines.map((line) => ({ ...line, qtyReceived: 4 })) }))

        const result = await service.receivePo("user-1", "ws-1", {
            poId: "po-1",
            invoiceNo: "",
            note: "",
            lines: [
                { lineId: UUID, qty: "4", unitCost: "6000" },
                { lineId: UUID_2, qty: "5", unitCost: "" },
                { lineId: "line-unknown", qty: "1", unitCost: "" },
                { lineId: UUID, qty: "0", unitCost: "" },
                { lineId: UUID, qty: "NaN", unitCost: "" },
            ],
        })

        expect(result).toEqual({
            status: "partially_received",
            received: 1,
            priceChanges: [],
            payableVnd: 24000,
            handedToAccounting: false,
        })
        expect(em.query).toHaveBeenCalledWith(OPEN_RECEIPT, ["ws-1", "po-1", null, "", "Lan"])
        expect(movements.apply).toHaveBeenCalledWith("ws-1", expect.objectContaining({ evidence: null }))
        expect(office.postOffice).not.toHaveBeenCalled()
        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({
                evidence: null,
                summary: expect.stringContaining("inventory.receivedPartSummary"),
            }),
        )
    })
})

describe("InventoryReceivingService / receivePo", () => {
    it("names the fallback supplier and item and writes the invoice into the payable", async () => {
        const em = mockEntityManager({
            query: [
                [OPEN_RECEIPT, [{ id: "rec-1" }]],
                [RECEIVE_PO_LINE, []],
                [CLOSE_RECEIPT, []],
                [SET_PO_STATUS, []],
                [RECOMPUTE_PO_TOTAL, [{ total: "1" }]],
                [SELECT_ACCOUNTING_INSTALLED, [{ id: "mod-1" }]],
            ],
        })
        const { service, orders, office } = await build(em)
        orders.loadPo.mockResolvedValue(poOf({ supplier: null }))

        await service.receivePo("user-1", "ws-1", {
            poId: "po-1",
            invoiceNo: "INV-1",
            note: "",
            lines: [{ lineId: UUID_2, qty: "1", unitCost: "300" }],
        })

        expect(office.postOffice).toHaveBeenCalledWith("ws-1", expect.stringContaining(text("inventory.itemFallback")))
        expect(office.postOffice).toHaveBeenCalledWith(
            "ws-1",
            expect.stringContaining(text("inventory.supplierFallback")),
        )
    })

    it("hands a payable to Accounting without an invoice number", async () => {
        const em = mockEntityManager({
            query: [
                [OPEN_RECEIPT, [{ id: "rec-1" }]],
                [RECEIVE_PO_LINE, []],
                [CLOSE_RECEIPT, []],
                [SET_PO_STATUS, []],
                [RECOMPUTE_PO_TOTAL, [{ total: "1" }]],
                [SELECT_ACCOUNTING_INSTALLED, [{ id: "mod-1" }]],
            ],
        })
        const { service, office } = await build(em)

        await service.receivePo("user-1", "ws-1", {
            poId: "po-1",
            invoiceNo: "",
            note: "",
            lines: [{ lineId: UUID_2, qty: "1", unitCost: "300" }],
        })

        expect(office.logEvidence).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ kind: "inventory.payable", evidence: null }),
        )
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", expect.stringContaining('"invoice":""'))
    })
})

describe("InventoryReceivingService / receivePo", () => {
    it("throws away the receipt when no line received anything", async () => {
        const em = mockEntityManager({
            query: [
                [OPEN_RECEIPT, [{ id: "rec-1" }]],
                [DISCARD_RECEIPT, []],
            ],
        })
        const { service } = await build(em)

        await expect(
            service.receivePo("user-1", "ws-1", {
                poId: "po-1",
                invoiceNo: "",
                note: "",
                lines: [{ lineId: UUID, qty: "0", unitCost: "" }],
            }),
        ).rejects.toMatchObject({
            code: InventoryErrorCode.ReceiptEmpty,
        })

        expect(em.query).toHaveBeenCalledWith(DISCARD_RECEIPT, ["rec-1"])
    })

    it("refuses an order that was not sent and a receipt the database did not open", async () => {
        const em = mockEntityManager({ query: [OPEN_RECEIPT, []] })
        const { service, orders } = await build(em)
        orders.loadPo.mockResolvedValueOnce(poOf({ status: "draft" })).mockResolvedValueOnce(poOf())

        await expect(
            service.receivePo("user-1", "ws-1", { poId: "po-1", invoiceNo: "", note: "", lines: [] }),
        ).rejects.toMatchObject({ code: InventoryErrorCode.PoNotReceivable })
        await expect(
            service.receivePo("user-1", "ws-1", { poId: "po-1", invoiceNo: "", note: "", lines: [] }),
        ).rejects.toMatchObject({ code: InventoryErrorCode.PoNotReceivable })
    })
})
