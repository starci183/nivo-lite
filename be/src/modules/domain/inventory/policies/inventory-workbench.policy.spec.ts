import { Test } from "@nestjs/testing"
import { buildInventoryWorkbench } from "./inventory-workbench.policy"
import type { InventoryWorkbenchRows } from "./inventory-workbench.policy"
import type { WorkbenchItemRow, WorkbenchPoRow, WorkbenchSupplierRow } from "../persistence/inventory-workbench.rows"

const SUBJECT = Symbol("inventory-workbench.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { buildInventoryWorkbench } }],
    }).compile()
    return moduleRef.get<typeof import("./inventory-workbench.policy")>(SUBJECT)
}

const now = "2026-10-14T00:00:00.000Z"
const context = { canManage: true, defaultLocationId: "loc-1", nowIso: now }
const rowsOf = (overrides: Partial<InventoryWorkbenchRows> = {}): InventoryWorkbenchRows => ({
    locations: [],
    suppliers: [],
    items: [],
    levels: [],
    recipes: [],
    recipeLines: [],
    pos: [],
    poLines: [],
    movements: [],
    work: [],
    stockOutItemIds: [],
    ...overrides,
})
const itemOf = (id: string, overrides: Partial<WorkbenchItemRow> = {}): WorkbenchItemRow => ({
    id,
    sku: id.toUpperCase(),
    name: id,
    unit: "kg",
    units: [],
    category: "Pantry",
    cost_vnd: "2.5",
    sell_price_vnd: null,
    reorder_point: "5",
    reorder_qty: "10",
    supplier_id: null,
    aliases: [],
    active: true,
    ...overrides,
})
const supplierOf = (overrides: Partial<WorkbenchSupplierRow> = {}): WorkbenchSupplierRow => ({
    id: "sup-1",
    name: "Mill",
    contact_name: "Lan",
    email: null,
    phone: null,
    zalo: null,
    channel: "unknown",
    lead_time_days: 0,
    payment_terms: "7 days",
    note: "Call first",
    ...overrides,
})
const poOf = (id: string, overrides: Partial<WorkbenchPoRow> = {}): WorkbenchPoRow => ({
    id,
    po_no: id.toUpperCase(),
    supplier_id: null,
    supplier_name: null,
    supplier_channel: null,
    status: "draft",
    total_vnd: "12.5",
    expected_at: null,
    message: "Please deliver",
    sent_via: null,
    send_note: null,
    work_item_id: null,
    reminders: 0,
    source: "manual",
    created_at: now,
    ...overrides,
})
const expectedSuppliers = [
    {
        id: "sup-1",
        name: "Mill",
        contactName: "Lan",
        email: "",
        phone: "",
        zalo: "",
        channel: "email",
        leadTimeDays: 0,
        paymentTerms: "7 days",
        note: "Call first",
    },
    {
        id: "sup-2",
        name: "Mill",
        contactName: "Lan",
        email: "a@b.vn",
        phone: "1",
        zalo: "2",
        channel: "zalo",
        leadTimeDays: 3,
        paymentTerms: "7 days",
        note: "Call first",
    },
    {
        id: "sup-3",
        name: "Mill",
        contactName: "Lan",
        email: "",
        phone: "",
        zalo: "",
        channel: "phone",
        leadTimeDays: 0,
        paymentTerms: "7 days",
        note: "Call first",
    },
]
const expectedLowItem = {
    id: "low",
    sku: "LOW",
    name: "low",
    unit: "kg",
    units: [],
    category: "Pantry",
    costVnd: 2.5,
    sellPriceVnd: null,
    reorderPoint: 5,
    reorderQty: 10,
    supplierId: null,
    aliases: [],
    active: true,
    total: 5,
    status: "low",
    onOrder: 0,
    levels: [
        { locationId: "loc-1", qty: 2 },
        { locationId: "loc-2", qty: 3 },
    ],
}
const purchaseOrderRows: Partial<InventoryWorkbenchRows> = {
    items: [itemOf("tea")],
    pos: [
        poOf("po-1", {
            supplier_id: "sup-1",
            supplier_name: "Mill",
            supplier_channel: "phone",
            status: "sent",
            sent_via: "email",
            source: "auto",
            expected_at: new Date(now),
            created_at: new Date(now),
            reminders: 2,
        }),
        poOf("po-2", {
            status: "received",
            sent_via: "copy",
            expected_at: "2026-10-15",
            supplier_channel: "email",
        }),
        poOf("po-3", { status: "unknown", sent_via: "other" }),
    ],
    poLines: [
        {
            id: "line-1",
            po_id: "po-1",
            item_id: "tea",
            qty_ordered: "10",
            qty_received: "2",
            unit_cost_vnd: "3",
        },
        { id: "line-2", po_id: "po-1", item_id: "tea", qty_ordered: 1, qty_received: 4, unit_cost_vnd: 0 },
        {
            id: "line-3",
            po_id: "po-1",
            item_id: "missing",
            qty_ordered: 2,
            qty_received: 0,
            unit_cost_vnd: 4,
        },
        {
            id: "line-4",
            po_id: "po-2",
            item_id: "tea",
            qty_ordered: 100,
            qty_received: 0,
            unit_cost_vnd: 3,
        },
    ],
}
const expectedOpenOrder = {
    id: "po-1",
    poNo: "PO-1",
    supplierId: "sup-1",
    supplierName: "Mill",
    channel: "phone",
    status: "sent",
    totalVnd: 12.5,
    expectedAt: "2026-10-14",
    message: "Please deliver",
    sentVia: "email",
    sendNote: null,
    workItemId: null,
    reminders: 2,
    source: "auto",
    createdAt: now,
    lines: [
        {
            id: "line-1",
            itemId: "tea",
            name: "tea",
            unit: "kg",
            qtyOrdered: 10,
            qtyReceived: 2,
            unitCost: 3,
        },
        {
            id: "line-2",
            itemId: "tea",
            name: "tea",
            unit: "kg",
            qtyOrdered: 1,
            qtyReceived: 4,
            unitCost: 0,
        },
        { id: "line-3", itemId: "missing", name: "", unit: "", qtyOrdered: 2, qtyReceived: 0, unitCost: 4 },
    ],
}
const expectedReceivedOrder = {
    id: "po-2",
    poNo: "PO-2",
    supplierId: null,
    supplierName: "",
    channel: "email",
    status: "received",
    totalVnd: 12.5,
    expectedAt: "2026-10-15",
    message: "Please deliver",
    sentVia: "copy",
    sendNote: null,
    workItemId: null,
    reminders: 0,
    source: "manual",
    createdAt: now,
    lines: [
        {
            id: "line-4",
            itemId: "tea",
            name: "tea",
            unit: "kg",
            qtyOrdered: 100,
            qtyReceived: 0,
            unitCost: 3,
        },
    ],
}
const historyRows: Partial<InventoryWorkbenchRows> = {
    items: [itemOf("tea")],
    recipes: [
        { id: "r-1", name: "Drink", aliases: ["cup"] },
        { id: "r-2", name: "Empty", aliases: [] },
    ],
    recipeLines: [
        { recipe_id: "r-1", item_id: "tea", qty: "2" },
        { recipe_id: "r-1", item_id: "missing", qty: "bad" },
    ],
    movements: [
        {
            id: "m-1",
            item_id: "tea",
            kind: "adjust",
            qty: "2",
            qty_after: "5",
            reason: "Count",
            ref_label: "PO-1",
            by_name: "Lan",
            evidence: "photo",
            created_at: new Date(now),
        },
        {
            id: "m-2",
            item_id: "missing",
            kind: "issue",
            qty: -1,
            qty_after: 0,
            reason: "Sale",
            ref_label: null,
            by_name: "Lan",
            evidence: null,
            created_at: now,
        },
    ],
    work: [
        {
            id: "w-1",
            action: "send_purchase_order",
            proposal: { fields: { po_id: "po-1" }, summary: "Send order", draft: "Order text" },
            created_at: now,
        },
        {
            id: "w-2",
            action: "adjust_stock",
            proposal: { fields: [], summary: 7, draft: false },
            created_at: new Date(now),
        },
        { id: "w-3", action: "other", proposal: {}, created_at: now },
        { id: "w-4", action: "adjust_stock", proposal: { fields: null }, created_at: now },
        { id: "w-5", action: "adjust_stock", proposal: { fields: "bad" }, created_at: now },
    ],
}
const expectedMovements = [
    {
        id: "m-1",
        itemName: "tea",
        unit: "kg",
        kind: "adjust",
        qty: 2,
        qtyAfter: 5,
        reason: "Count",
        refLabel: "PO-1",
        byName: "Lan",
        evidence: "photo",
        createdAt: now,
    },
    {
        id: "m-2",
        itemName: "",
        unit: "",
        kind: "issue",
        qty: -1,
        qtyAfter: 0,
        reason: "Sale",
        refLabel: "",
        byName: "Lan",
        evidence: "",
        createdAt: now,
    },
]
describe("buildInventoryWorkbench", () => {
    it.each([null, undefined])("keeps empty strings for nullable or missing database dates (%s)", async (date) => {
        const subject = await buildSubject()
        const po = Object.assign(poOf("po-1"), { created_at: date, expected_at: undefined })
        const result = subject.buildInventoryWorkbench(rowsOf({ pos: [po] }), context)
        expect(result.pos[0]?.createdAt).toBe("")
        expect(result.pos[0]?.expectedAt).toBe("")
    })
    it("returns an empty workbench with caller context and unavailable stock history", async () => {
        const subject = await buildSubject()
        expect(
            subject.buildInventoryWorkbench(rowsOf({ stockOutItemIds: null }), {
                canManage: false,
                defaultLocationId: null,
                nowIso: now,
            }),
        ).toEqual({
            canManage: false,
            defaultLocationId: null,
            nowIso: now,
            locations: [],
            suppliers: [],
            items: [],
            recipes: [],
            pos: [],
            movements: [],
            pending: [],
            stockOuts7d: null,
            metrics: { valueVnd: 0, itemCount: 0, lowCount: 0, outCount: 0, openPos: 0, pendingCount: 0 },
        })
    })
})
describe("buildInventoryWorkbench", () => {
    it("shapes catalogue rows, groups stock, and counts only active items in metrics and stockouts", async () => {
        const subject = await buildSubject()
        const locations = [{ id: "loc-1", name: "Shop" }]
        const result = subject.buildInventoryWorkbench(
            rowsOf({
                locations,
                suppliers: [
                    supplierOf(),
                    supplierOf({
                        id: "sup-2",
                        channel: "zalo",
                        email: "a@b.vn",
                        phone: "1",
                        zalo: "2",
                        lead_time_days: 3,
                    }),
                    supplierOf({ id: "sup-3", channel: "phone" }),
                ],
                items: [
                    itemOf("out"),
                    itemOf("low"),
                    itemOf("over"),
                    itemOf("ok"),
                    itemOf("inactive", { active: false }),
                    itemOf("no-point", { reorder_point: 0, reorder_qty: 0 }),
                    itemOf("fallback", { reorder_qty: 0 }),
                ],
                levels: [
                    { item_id: "low", location_id: "loc-1", qty: "2" },
                    { item_id: "low", location_id: "loc-2", qty: 3 },
                    { item_id: "over", location_id: "loc-1", qty: 26 },
                    { item_id: "ok", location_id: "loc-1", qty: 6 },
                    { item_id: "inactive", location_id: "loc-1", qty: -3 },
                    { item_id: "no-point", location_id: "loc-1", qty: 100 },
                    { item_id: "fallback", location_id: "loc-1", qty: 16 },
                ],
                stockOutItemIds: ["out", "out", "inactive", "missing", "low"],
            }),
            context,
        )
        expect(result.locations).toEqual(locations)
        expect(result.locations).not.toBe(locations)
        expect(result.suppliers).toEqual(expectedSuppliers)
        expect(result.items[1]).toEqual(expectedLowItem)
        expect(result.items.map(({ id, total, status }) => ({ id, total, status }))).toEqual([
            { id: "out", total: 0, status: "out" },
            { id: "low", total: 5, status: "low" },
            { id: "over", total: 26, status: "over" },
            { id: "ok", total: 6, status: "ok" },
            { id: "inactive", total: -3, status: "out" },
            { id: "no-point", total: 100, status: "ok" },
            { id: "fallback", total: 16, status: "over" },
        ])
        expect(result.metrics).toEqual({
            valueVnd: 383,
            itemCount: 6,
            lowCount: 1,
            outCount: 1,
            openPos: 0,
            pendingCount: 0,
        })
        expect(result.stockOuts7d).toBe(2)
    })
})
describe("buildInventoryWorkbench", () => {
    it("groups order lines and totals only outstanding quantities on open purchase orders", async () => {
        const subject = await buildSubject()
        const result = subject.buildInventoryWorkbench(rowsOf(purchaseOrderRows), context)
        expect(result.items[0]?.onOrder).toBe(8)
        expect(result.pos).toEqual([
            expectedOpenOrder,
            expectedReceivedOrder,
            {
                id: "po-3",
                poNo: "PO-3",
                supplierId: null,
                supplierName: "",
                channel: null,
                status: "draft",
                totalVnd: 12.5,
                expectedAt: null,
                message: "Please deliver",
                sentVia: null,
                sendNote: null,
                workItemId: null,
                reminders: 0,
                source: "manual",
                createdAt: now,
                lines: [],
            },
        ])
        expect(result.metrics.openPos).toBe(2)
    })
    it("maps recipes, movement history, and supported pending proposals with safe field defaults", async () => {
        const subject = await buildSubject()
        const result = subject.buildInventoryWorkbench(rowsOf(historyRows), context)
        expect(result.recipes).toEqual([
            {
                id: "r-1",
                name: "Drink",
                aliases: ["cup"],
                lines: [
                    { itemId: "tea", name: "tea", unit: "kg", qty: 2 },
                    { itemId: "missing", name: "", unit: "", qty: 0 },
                ],
            },
            { id: "r-2", name: "Empty", aliases: [], lines: [] },
        ])
        expect(result.movements).toEqual(expectedMovements)
        expect(result.pending).toEqual([
            {
                id: "w-1",
                action: "send_purchase_order",
                summary: "Send order",
                draft: "Order text",
                poId: "po-1",
                createdAt: now,
            },
            ...["w-2", "w-4", "w-5"].map((id) => ({
                id,
                action: "adjust_stock",
                summary: "",
                draft: null,
                poId: null,
                createdAt: now,
            })),
        ])
        expect(result.metrics.pendingCount).toBe(4)
    })
})
