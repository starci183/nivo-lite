import type { DescriptionListStatItem } from "@starci/grammar/common"
import type {
    InventoryItemType,
    InventoryMovementType,
    InventoryPendingType,
    InventoryPoType,
    InventoryRecipeType,
    InventorySupplierType,
    InventoryWorkbenchType,
} from "@/modules/api"
import type {
    InventoryWorkbenchData,
    ItemView,
    PendingView,
    PoStatus,
    PoView,
    StockStatus,
    SupplierChannel,
} from "@/modules/types"

const STOCK_STATUSES: ReadonlyArray<StockStatus> = ["out", "low", "ok", "over"]

const SUPPLIER_CHANNELS: ReadonlyArray<SupplierChannel> = ["email", "zalo", "phone"]

const channelOf = (value: string | null | undefined): SupplierChannel | null =>
    SUPPLIER_CHANNELS.find((channel) => channel === value) ?? null

const stockStatusOf = (value: string): StockStatus => STOCK_STATUSES.find((status) => status === value) ?? "ok"

const PO_STATUSES: ReadonlyArray<PoStatus> = [
    "draft",
    "waiting_approval",
    "sent",
    "partially_received",
    "received",
    "cancelled",
]

const poStatusOf = (value: string): PoStatus => PO_STATUSES.find((status) => status === value) ?? "draft"

const toItemView = (row: InventoryItemType): ItemView => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    unit: row.unit,
    units: row.units ?? [],
    category: row.category,
    costVnd: row.costVnd,
    sellPriceVnd: row.sellPriceVnd ?? null,
    reorderPoint: row.reorderPoint,
    reorderQty: row.reorderQty,
    supplierId: row.supplierId ?? null,
    aliases: row.aliases ?? [],
    active: row.active,
    total: row.total,
    status: stockStatusOf(row.status),
    onOrder: row.onOrder,
    levels: row.levels ?? [],
})

const toSupplierView = (row: InventorySupplierType) => ({
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    email: row.email === "" ? null : row.email,
    phone: row.phone === "" ? null : row.phone,
    zalo: row.zalo === "" ? null : row.zalo,
    channel: channelOf(row.channel) ?? "email",
    leadTimeDays: row.leadTimeDays,
    paymentTerms: row.paymentTerms,
    note: row.note,
})

const toPoView = (row: InventoryPoType): PoView => ({
    id: row.id,
    poNo: row.poNo,
    supplierId: row.supplierId ?? null,
    supplierName: row.supplierName,
    channel: channelOf(row.channel),
    status: poStatusOf(row.status),
    totalVnd: row.totalVnd,
    expectedAt: row.expectedAt ?? null,
    message: row.message,
    sentVia: row.sentVia === "email" || row.sentVia === "copy" ? row.sentVia : null,
    sendNote: row.sendNote ?? null,
    workItemId: row.workItemId ?? null,
    reminders: row.reminders,
    source: row.source === "auto" ? "auto" : "manual",
    createdAt: row.createdAt,
    lines: row.lines ?? [],
})

const toMovementView = (row: InventoryMovementType) => ({
    id: row.id,
    itemName: row.itemName,
    unit: row.unit,
    kind: row.kind,
    qty: row.qty,
    qtyAfter: row.qtyAfter,
    reason: row.reason,
    refLabel: row.refLabel === "" ? null : row.refLabel,
    byName: row.byName,
    evidence: row.evidence === "" ? null : row.evidence,
    createdAt: row.createdAt,
})

const toPendingView = (row: InventoryPendingType): PendingView | null => {
    if (row.action !== "send_purchase_order" && row.action !== "adjust_stock") return null
    return {
        id: row.id,
        action: row.action,
        summary: row.summary,
        draft: row.draft ?? null,
        poId: row.poId ?? null,
        createdAt: row.createdAt,
    }
}

const toRecipeView = (row: InventoryRecipeType) => ({
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    lines: row.lines ?? [],
})

/** The `inventoryWorkbench` answer as the view model the blocks already render. */
export const toInventoryWorkbenchData = (bench: InventoryWorkbenchType): InventoryWorkbenchData => ({
    canManage: bench.canManage,
    defaultLocationId: bench.defaultLocationId ?? null,
    locations: bench.locations ?? [],
    suppliers: (bench.suppliers ?? []).map(toSupplierView),
    items: (bench.items ?? []).map(toItemView),
    recipes: (bench.recipes ?? []).map(toRecipeView),
    pos: (bench.pos ?? []).map(toPoView),
    movements: (bench.movements ?? []).map(toMovementView),
    pending: (bench.pending ?? []).flatMap((row) => {
        const view = toPendingView(row)
        return view === null ? [] : [view]
    }),
    metrics: bench.metrics,
    stockOuts7d: bench.stockOuts7d ?? null,
    nowIso: bench.nowIso,
})

/** What the figures ribbon needs to turn a number into words: the translator and the formatter of the page. */
export interface InventoryFiguresWords {
    /** Translates a `workbenchInventory` key with optional values. */
    readonly t: (key: string, values?: Record<string, number>) => string
    /** Formats the stock value as VND. */
    readonly money: (value: number) => string
}

/** The ribbon: items under their reorder level, orders waiting, stock value and the stock-outs of the week. */
export const inventoryFigures = (
    data: InventoryWorkbenchData,
    words: InventoryFiguresWords,
): ReadonlyArray<DescriptionListStatItem> => {
    const active = data.items.filter((item) => item.active)
    const below = active.filter((item) => item.reorderPoint > 0 && item.total <= item.reorderPoint).length
    const awaiting = data.pos.filter((po) => po.status === "waiting_approval").length
    return [
        {
            id: "reorder",
            term: words.t("metricReorder"),
            description: String(below),
            meta: words.t("metricReorderBasis", { n: active.length }),
        },
        {
            id: "awaiting",
            term: words.t("metricAwaiting"),
            description: String(awaiting),
            meta: words.t("metricAwaitingBasis"),
        },
        {
            id: "value",
            term: words.t("metricValue"),
            description: words.money(data.metrics.valueVnd),
            meta: words.t("metricValueBasis"),
        },
        {
            id: "stockouts",
            term: words.t("metricStockOuts"),
            description: data.stockOuts7d === null ? "-" : String(data.stockOuts7d),
            meta: words.t(data.stockOuts7d === null ? "metricStockOutsUnknown" : "metricStockOutsBasis"),
        },
    ]
}
