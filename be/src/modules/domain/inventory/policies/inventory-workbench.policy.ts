import { toInventoryItem } from "./item-row.policy"
import type {
    InventoryItemView,
    InventoryLevelView,
    InventoryMetricsView,
    InventoryMovementView,
    InventoryPendingView,
    InventoryPoLineView,
    InventoryPoStatus,
    InventoryPoView,
    InventoryRecipeView,
    InventoryStockStatus,
    InventorySupplierChannel,
    InventorySupplierView,
    InventoryWorkbenchContext,
    InventoryWorkbenchView,
} from "../inventory-workbench.contracts"
import type {
    WorkbenchItemRow,
    WorkbenchLevelRow,
    WorkbenchMovementRow,
    WorkbenchPoLineRow,
    WorkbenchPoRow,
    WorkbenchRecipeLineRow,
    WorkbenchRecipeRow,
    WorkbenchSupplierRow,
    WorkbenchWorkRow,
} from "../persistence/inventory-workbench.rows"

/** The rows the workbench read, before they are shaped. */
export interface InventoryWorkbenchRows {
    /** The stock locations, default first. */
    readonly locations: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** The suppliers. */
    readonly suppliers: ReadonlyArray<WorkbenchSupplierRow>
    /** The catalogue items. */
    readonly items: ReadonlyArray<WorkbenchItemRow>
    /** The stock levels. */
    readonly levels: ReadonlyArray<WorkbenchLevelRow>
    /** The active recipes. */
    readonly recipes: ReadonlyArray<WorkbenchRecipeRow>
    /** The recipe lines. */
    readonly recipeLines: ReadonlyArray<WorkbenchRecipeLineRow>
    /** The purchase orders. */
    readonly pos: ReadonlyArray<WorkbenchPoRow>
    /** The purchase order lines. */
    readonly poLines: ReadonlyArray<WorkbenchPoLineRow>
    /** The recent movements. */
    readonly movements: ReadonlyArray<WorkbenchMovementRow>
    /** The decisions waiting. */
    readonly work: ReadonlyArray<WorkbenchWorkRow>
    /** The items that stocked out lately; null when the history could not be read. */
    readonly stockOutItemIds: ReadonlyArray<string> | null
}

/** The statuses of purchase orders that still owe goods. */
const OPEN_STATUSES: ReadonlyArray<string> = ["draft", "waiting_approval", "sent", "partially_received"]

const PO_STATUSES: ReadonlyArray<InventoryPoStatus> = [
    "draft",
    "waiting_approval",
    "sent",
    "partially_received",
    "received",
    "cancelled",
]

/** The ceiling above which an item counts as overstocked: the reorder point plus two usual orders. */
const OVER_ORDERS = 2

const number = (value: number | string | null | undefined): number => Number(value) || 0

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {})

const iso = (value: Date | string): string => {
    if (typeof value === "string") return value
    return value.toISOString()
}

/** Out when nothing is left, low at or below the reorder point (when one is set), over when far above what is needed. */
const stockStatus = (reorderPoint: number, reorderQty: number, total: number): InventoryStockStatus => {
    if (total <= 0) return "out"
    if (reorderPoint > 0 && total <= reorderPoint) return "low"
    const usual = reorderQty > 0 ? reorderQty : reorderPoint
    const ceiling = reorderPoint > 0 ? reorderPoint + OVER_ORDERS * usual : 0
    return ceiling > 0 && total > ceiling ? "over" : "ok"
}

const channelOf = (value: string | null): InventorySupplierChannel =>
    value === "zalo" || value === "phone" ? value : "email"

const poStatusOf = (value: string): InventoryPoStatus => PO_STATUSES.find((status) => status === value) ?? "draft"

const toSupplier = (row: WorkbenchSupplierRow): InventorySupplierView => ({
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    zalo: row.zalo ?? "",
    channel: channelOf(row.channel),
    leadTimeDays: number(row.lead_time_days),
    paymentTerms: row.payment_terms,
    note: row.note,
})

const levelsByItem = (
    levels: ReadonlyArray<WorkbenchLevelRow>,
): ReadonlyMap<string, ReadonlyArray<InventoryLevelView>> => {
    const grouped = new Map<string, Array<InventoryLevelView>>()
    for (const level of levels) {
        grouped.set(level.item_id, [
            ...(grouped.get(level.item_id) ?? []),
            { locationId: level.location_id, qty: number(level.qty) },
        ])
    }
    return grouped
}

const onOrderByItem = (
    pos: ReadonlyArray<WorkbenchPoRow>,
    lines: ReadonlyArray<WorkbenchPoLineRow>,
): ReadonlyMap<string, number> => {
    const open = new Set(pos.filter((po) => OPEN_STATUSES.includes(po.status)).map((po) => po.id))
    const totals = new Map<string, number>()
    for (const line of lines) {
        if (!open.has(line.po_id)) continue
        const remaining = Math.max(0, number(line.qty_ordered) - number(line.qty_received))
        totals.set(line.item_id, (totals.get(line.item_id) ?? 0) + remaining)
    }
    return totals
}

const toItem = (
    row: WorkbenchItemRow,
    levels: ReadonlyArray<InventoryLevelView>,
    onOrder: number,
): InventoryItemView => {
    const total = levels.reduce((sum, level) => sum + level.qty, 0)
    const item = toInventoryItem(row)
    return {
        ...item,
        total,
        status: stockStatus(item.reorderPoint, item.reorderQty, total),
        onOrder,
        levels,
    }
}

const toPo = (row: WorkbenchPoRow, lines: ReadonlyArray<InventoryPoLineView>): InventoryPoView => ({
    id: row.id,
    poNo: row.po_no,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? "",
    channel: row.supplier_channel === null ? null : channelOf(row.supplier_channel),
    status: poStatusOf(row.status),
    totalVnd: number(row.total_vnd),
    expectedAt: row.expected_at === null ? null : iso(row.expected_at).slice(0, 10),
    message: row.message,
    sentVia: row.sent_via === "email" || row.sent_via === "copy" ? row.sent_via : null,
    sendNote: row.send_note,
    workItemId: row.work_item_id,
    reminders: number(row.reminders),
    source: row.source === "auto" ? "auto" : "manual",
    createdAt: iso(row.created_at),
    lines,
})

const toPending = (row: WorkbenchWorkRow): InventoryPendingView | null => {
    if (row.action !== "send_purchase_order" && row.action !== "adjust_stock") return null
    const proposal = record(row.proposal)
    const fields = record(proposal.fields)
    const poId = text(fields.po_id)
    const draft = text(proposal.draft)
    return {
        id: row.id,
        action: row.action,
        summary: text(proposal.summary),
        draft: draft === "" ? null : draft,
        poId: poId === "" ? null : poId,
        createdAt: iso(row.created_at),
    }
}

const poLinesOf = (
    rows: ReadonlyArray<WorkbenchPoLineRow>,
    items: ReadonlyMap<string, WorkbenchItemRow>,
): ReadonlyMap<string, ReadonlyArray<InventoryPoLineView>> => {
    const grouped = new Map<string, Array<InventoryPoLineView>>()
    for (const line of rows) {
        const item = items.get(line.item_id)
        const view: InventoryPoLineView = {
            id: line.id,
            itemId: line.item_id,
            name: item?.name ?? "",
            unit: item?.unit ?? "",
            qtyOrdered: number(line.qty_ordered),
            qtyReceived: number(line.qty_received),
            unitCost: number(line.unit_cost_vnd),
        }
        grouped.set(line.po_id, [...(grouped.get(line.po_id) ?? []), view])
    }
    return grouped
}

const recipesOf = (
    rows: InventoryWorkbenchRows,
    items: ReadonlyMap<string, WorkbenchItemRow>,
): ReadonlyArray<InventoryRecipeView> =>
    rows.recipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        aliases: recipe.aliases,
        lines: rows.recipeLines
            .filter((line) => line.recipe_id === recipe.id)
            .map((line) => ({
                itemId: line.item_id,
                name: items.get(line.item_id)?.name ?? "",
                unit: items.get(line.item_id)?.unit ?? "",
                qty: number(line.qty),
            })),
    }))

const movementsOf = (
    rows: ReadonlyArray<WorkbenchMovementRow>,
    items: ReadonlyMap<string, WorkbenchItemRow>,
): ReadonlyArray<InventoryMovementView> =>
    rows.map((row) => ({
        id: row.id,
        itemName: items.get(row.item_id)?.name ?? "",
        unit: items.get(row.item_id)?.unit ?? "",
        kind: row.kind,
        qty: number(row.qty),
        qtyAfter: number(row.qty_after),
        reason: row.reason,
        refLabel: row.ref_label ?? "",
        byName: row.by_name,
        evidence: row.evidence ?? "",
        createdAt: iso(row.created_at),
    }))

const stockOutsOf = (ids: ReadonlyArray<string> | null, active: ReadonlyArray<InventoryItemView>): number | null => {
    if (ids === null) return null
    const activeIds = new Set(active.map((item) => item.id))
    return new Set(ids.filter((id) => activeIds.has(id))).size
}

const metricsOf = (
    active: ReadonlyArray<InventoryItemView>,
    pos: ReadonlyArray<InventoryPoView>,
    pending: ReadonlyArray<InventoryPendingView>,
): InventoryMetricsView => ({
    valueVnd: Math.round(active.reduce((sum, item) => sum + Math.max(0, item.total) * item.costVnd, 0)),
    itemCount: active.length,
    lowCount: active.filter((item) => item.status === "low").length,
    outCount: active.filter((item) => item.status === "out").length,
    openPos: pos.filter((po) => OPEN_STATUSES.includes(po.status)).length,
    pendingCount: pending.length,
})

/** Shapes the rows of one workspace into the whole inventory workbench. */
export const buildInventoryWorkbench = (
    rows: InventoryWorkbenchRows,
    context: InventoryWorkbenchContext,
): InventoryWorkbenchView => {
    const byId = new Map(rows.items.map((item) => [item.id, item]))
    const levels = levelsByItem(rows.levels)
    const onOrder = onOrderByItem(rows.pos, rows.poLines)
    const items = rows.items.map((item) => toItem(item, levels.get(item.id) ?? [], onOrder.get(item.id) ?? 0))
    const active = items.filter((item) => item.active)
    const lines = poLinesOf(rows.poLines, byId)
    const pos = rows.pos.map((po) => toPo(po, lines.get(po.id) ?? []))
    const pending = rows.work.flatMap((row) => {
        const view = toPending(row)
        return view === null ? [] : [view]
    })
    return {
        canManage: context.canManage,
        defaultLocationId: context.defaultLocationId,
        locations: [...rows.locations],
        suppliers: rows.suppliers.map(toSupplier),
        items,
        recipes: recipesOf(rows, byId),
        pos,
        movements: movementsOf(rows.movements, byId),
        pending,
        metrics: metricsOf(active, pos, pending),
        stockOuts7d: stockOutsOf(rows.stockOutItemIds, active),
        nowIso: context.nowIso,
    }
}
