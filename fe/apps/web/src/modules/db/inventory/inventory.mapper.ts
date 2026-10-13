import { z } from "zod"
import type { Database, Json } from "../../../../../../../supabase/types/database.types"
import type {
    InventoryWorkbenchData,
    ItemUnit,
    ItemView,
    MovementView,
    PendingView,
    PoLineView,
    PoStatus,
    PoView,
    RecipeView,
    StockStatus,
    SupplierChannel,
    SupplierView,
} from "@/modules/types"

type Tables = Database["public"]["Tables"]

/** The item columns the workbench reads. */
export type ItemRow = Tables["inventory_items"]["Row"]
/** The supplier columns the workbench reads. */
export type SupplierRow = Tables["inventory_suppliers"]["Row"]
/** The stock level columns the workbench reads. */
export type LevelRow = Pick<Tables["inventory_stock_levels"]["Row"], "item_id" | "location_id" | "qty">
/** The location columns the workbench reads. */
export type LocationRow = Pick<Tables["inventory_locations"]["Row"], "id" | "name" | "is_default">
/** The recipe columns the workbench reads. */
export type RecipeRow = Pick<Tables["inventory_recipes"]["Row"], "id" | "name" | "aliases">
/** The recipe line columns the workbench reads. */
export type RecipeLineRow = Pick<Tables["inventory_recipe_lines"]["Row"], "recipe_id" | "item_id" | "qty">
/** A purchase order with the name and channel of its supplier. */
export type PoRow = Tables["inventory_purchase_orders"]["Row"] & {
    readonly supplier: { readonly name: string; readonly channel: string } | null
}
/** The purchase order line columns the workbench reads. */
export type PoLineRow = Tables["inventory_po_lines"]["Row"]
/** The movement columns the history reads. */
export type MovementRow = Pick<
    Tables["inventory_movements"]["Row"],
    "id" | "item_id" | "kind" | "qty" | "qty_after" | "reason" | "ref_label" | "by_name" | "evidence" | "created_at"
>
/** The work item columns the waiting list reads. */
export type WorkRow = Pick<Tables["work_items"]["Row"], "id" | "action" | "proposal" | "created_at">

/** Everything the reader fetched, before it is shaped. */
export interface InventoryRows {
    readonly locations: ReadonlyArray<LocationRow>
    readonly suppliers: ReadonlyArray<SupplierRow>
    readonly items: ReadonlyArray<ItemRow>
    readonly levels: ReadonlyArray<LevelRow>
    readonly recipes: ReadonlyArray<RecipeRow>
    readonly recipeLines: ReadonlyArray<RecipeLineRow>
    readonly pos: ReadonlyArray<PoRow>
    readonly poLines: ReadonlyArray<PoLineRow>
    readonly movements: ReadonlyArray<MovementRow>
    readonly work: ReadonlyArray<WorkRow>
    /** The items that went to zero or below by a stock movement in the last 7 days; null when that history could not be read. */
    readonly stockOutItemIds: ReadonlyArray<string> | null
}

/** Who is asking and when. */
export interface InventoryContext {
    readonly canManage: boolean
    readonly nowIso: string
}

/** The commands a member may submit, as the database function accepts them. */
export const inventoryCommandSchema = z.object({
    workspaceId: z.uuid(),
    kind: z.enum([
        "save-item",
        "set-item-active",
        "save-supplier",
        "save-recipe",
        "delete-recipe",
        "save-location",
        "import-paste",
        "apply-starter",
        "adjust-stock",
        "stock-take",
        "transfer-stock",
        "draft-low-stock",
        "create-po",
        "update-po-draft",
        "request-send",
        "cancel-po",
        "receive-po",
    ]),
})

const OPEN_STATUSES: ReadonlyArray<string> = ["draft", "waiting_approval", "sent", "partially_received"]

const PO_STATUSES: ReadonlyArray<PoStatus> = [
    "draft",
    "waiting_approval",
    "sent",
    "partially_received",
    "received",
    "cancelled",
]

/** The ceiling above which an item counts as overstocked: the reorder point plus two usual orders. */
const OVER_ORDERS = 2

const record = (value: Json): Record<string, Json | undefined> =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}

const textOf = (value: Json | undefined): string => (typeof value === "string" ? value : "")

const number = (value: number | string | null): number => Number(value) || 0

/** Out when nothing is left, low at or below the reorder point (when one is set), over when far above what is needed. */
const stockStatus = (reorderPoint: number, reorderQty: number, total: number): StockStatus => {
    if (total <= 0) return "out"
    if (reorderPoint > 0 && total <= reorderPoint) return "low"
    const usual = reorderQty > 0 ? reorderQty : reorderPoint
    const ceiling = reorderPoint > 0 ? reorderPoint + OVER_ORDERS * usual : 0
    return ceiling > 0 && total > ceiling ? "over" : "ok"
}

const unitsOf = (value: Json): ReadonlyArray<ItemUnit> =>
    Array.isArray(value)
        ? value.flatMap((entry) => {
              const fields = record(entry)
              const unit = textOf(fields.unit)
              const factor = Number(fields.factor)
              return unit !== "" && factor > 0 ? [{ unit, factor }] : []
          })
        : []

const channelOf = (value: string): SupplierChannel => (value === "zalo" || value === "phone" ? value : "email")

const poStatusOf = (value: string): PoStatus => PO_STATUSES.find((status) => status === value) ?? "draft"

const toSupplier = (row: SupplierRow): SupplierView => ({
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    zalo: row.zalo,
    channel: channelOf(row.channel),
    leadTimeDays: number(row.lead_time_days),
    paymentTerms: row.payment_terms,
    note: row.note,
})

const levelsByItem = (
    levels: ReadonlyArray<LevelRow>,
): ReadonlyMap<string, ReadonlyArray<{ locationId: string; qty: number }>> => {
    const grouped = new Map<string, Array<{ locationId: string; qty: number }>>()
    for (const level of levels) {
        grouped.set(level.item_id, [
            ...(grouped.get(level.item_id) ?? []),
            { locationId: level.location_id, qty: number(level.qty) },
        ])
    }
    return grouped
}

const onOrderByItem = (pos: ReadonlyArray<PoRow>, lines: ReadonlyArray<PoLineRow>): ReadonlyMap<string, number> => {
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
    row: ItemRow,
    levels: ReadonlyArray<{ locationId: string; qty: number }>,
    onOrder: number,
): ItemView => {
    const total = levels.reduce((sum, level) => sum + level.qty, 0)
    return {
        id: row.id,
        sku: row.sku,
        name: row.name,
        unit: row.unit,
        units: unitsOf(row.units),
        category: row.category,
        costVnd: number(row.cost_vnd),
        sellPriceVnd: row.sell_price_vnd === null ? null : number(row.sell_price_vnd),
        reorderPoint: number(row.reorder_point),
        reorderQty: number(row.reorder_qty),
        supplierId: row.supplier_id,
        aliases: row.aliases,
        active: row.active,
        total,
        status: stockStatus(number(row.reorder_point), number(row.reorder_qty), total),
        onOrder,
        levels,
    }
}

const toPo = (row: PoRow, lines: ReadonlyArray<PoLineView>): PoView => ({
    id: row.id,
    poNo: row.po_no,
    supplierId: row.supplier_id,
    supplierName: row.supplier?.name ?? "",
    channel: row.supplier === null ? null : channelOf(row.supplier.channel),
    status: poStatusOf(row.status),
    totalVnd: number(row.total_vnd),
    expectedAt: row.expected_at,
    message: row.message,
    sentVia: row.sent_via === "email" || row.sent_via === "copy" ? row.sent_via : null,
    sendNote: row.send_note,
    workItemId: row.work_item_id,
    reminders: number(row.reminders),
    source: row.source === "auto" ? "auto" : "manual",
    createdAt: row.created_at,
    lines,
})

const toPending = (row: WorkRow): PendingView | null => {
    if (row.action !== "send_purchase_order" && row.action !== "adjust_stock") return null
    const proposal = record(row.proposal)
    const fields = record(proposal.fields ?? null)
    const poId = textOf(fields.po_id)
    const draft = textOf(proposal.draft)
    return {
        id: row.id,
        action: row.action,
        summary: textOf(proposal.summary),
        draft: draft === "" ? null : draft,
        poId: poId === "" ? null : poId,
        createdAt: row.created_at,
    }
}

const poLinesOf = (
    rows: ReadonlyArray<PoLineRow>,
    items: ReadonlyMap<string, ItemRow>,
): ReadonlyMap<string, ReadonlyArray<PoLineView>> => {
    const grouped = new Map<string, Array<PoLineView>>()
    for (const line of rows) {
        const item = items.get(line.item_id)
        const view: PoLineView = {
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

const recipesOf = (rows: InventoryRows, items: ReadonlyMap<string, ItemRow>): ReadonlyArray<RecipeView> =>
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
    rows: ReadonlyArray<MovementRow>,
    items: ReadonlyMap<string, ItemRow>,
): ReadonlyArray<MovementView> =>
    rows.map((row) => ({
        id: row.id,
        itemName: items.get(row.item_id)?.name ?? "",
        unit: items.get(row.item_id)?.unit ?? "",
        kind: row.kind,
        qty: number(row.qty),
        qtyAfter: number(row.qty_after),
        reason: row.reason,
        refLabel: row.ref_label,
        byName: row.by_name,
        evidence: row.evidence,
        createdAt: row.created_at,
    }))

const stockOutsOf = (ids: ReadonlyArray<string> | null, active: ReadonlyArray<ItemView>): number | null => {
    if (ids === null) return null
    const activeIds = new Set(active.map((item) => item.id))
    return new Set(ids.filter((id) => activeIds.has(id))).size
}

/** Shapes the rows of one workspace into the whole inventory workbench. */
export const buildInventoryWorkbench = (rows: InventoryRows, context: InventoryContext): InventoryWorkbenchData => {
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
        defaultLocationId: rows.locations[0]?.id ?? null,
        locations: rows.locations.map((location) => ({ id: location.id, name: location.name })),
        suppliers: rows.suppliers.map(toSupplier),
        items,
        recipes: recipesOf(rows, byId),
        pos,
        movements: movementsOf(rows.movements, byId),
        pending,
        metrics: {
            valueVnd: Math.round(active.reduce((sum, item) => sum + Math.max(0, item.total) * item.costVnd, 0)),
            itemCount: active.length,
            lowCount: active.filter((item) => item.status === "low").length,
            outCount: active.filter((item) => item.status === "out").length,
            openPos: pos.filter((po) => OPEN_STATUSES.includes(po.status)).length,
            pendingCount: pending.length,
        },
        stockOuts7d: stockOutsOf(rows.stockOutItemIds, active),
        nowIso: context.nowIso,
    }
}
