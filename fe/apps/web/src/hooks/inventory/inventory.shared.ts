import type { useTranslations } from "next-intl"
import type { useInventoryFormat } from "./useInventoryFormat"
import type { InventoryWorkbenchData, ItemView, PoStatus, StockStatus } from "@/modules/types"

/** The stock filter of the item list. */
export type StockFilter = "all" | "low" | "out" | "over"

/** The ways to change a quantity by hand. */
export type AdjustMode = "set" | "delta" | "move"

/** The stock filters in display order. */
export const STOCK_FILTERS: ReadonlyArray<StockFilter> = ["all", "low", "out", "over"]

/** The purchase order lanes in display order. */
export const PO_LANES: ReadonlyArray<PoStatus> = [
    "draft",
    "waiting_approval",
    "sent",
    "partially_received",
    "received",
    "cancelled",
]

/** The badge tone of a stock status. */
export const STOCK_TONES: Readonly<Record<StockStatus, "danger" | "warning" | "success" | "neutral">> = {
    out: "danger",
    low: "warning",
    ok: "success",
    over: "neutral",
}

/** The badge tone of a purchase order status. */
export const PO_TONES: Readonly<Record<PoStatus, "neutral" | "warning" | "accent" | "success">> = {
    draft: "neutral",
    waiting_approval: "warning",
    sent: "accent",
    partially_received: "accent",
    received: "success",
    cancelled: "neutral",
}

/** The badge tone of a movement kind. */
export const MOVE_TONES: Readonly<Record<string, "success" | "neutral" | "warning" | "accent">> = {
    in: "success",
    out: "neutral",
    adjust: "warning",
    transfer: "accent",
}

/** The movement kinds the history names; any other kind shows as typed. */
export const MOVE_KINDS: ReadonlyArray<string> = ["in", "out", "adjust", "transfer"]

/** An adjustment worth at most this many dong is applied at once. */
const SMALL_ADJUST_VND = 200_000

/** An adjustment of an item with no cost is small up to this many units. */
const SMALL_ADJUST_QTY_NO_COST = 5

/** The size of a quick change above which the step grows tenfold: stock counted in grams steps by tens. */
const STEP_BASIS_MAX = 100

/** An adjustment this small is applied at once; a bigger one waits for the owner. */
export const isSmallAdjustment = (delta: number, costVnd: number): boolean =>
    costVnd > 0 ? Math.abs(delta) * costVnd <= SMALL_ADJUST_VND : Math.abs(delta) <= SMALL_ADJUST_QTY_NO_COST

/** A purchase order that can still bring goods in. */
export const isOpenPo = (status: PoStatus): boolean =>
    status === "draft" || status === "waiting_approval" || status === "sent" || status === "partially_received"

/** Reads a typed number: "1,5" and "1.5" both mean 1.5, "1.200" means 1200; anything unreadable is the fallback. */
export const num = (value: string, fallback = 0): number => {
    const bare = value.trim().replace(/\s/g, "")
    if (bare === "") return fallback
    const grouped = /^\d{1,3}(\.\d{3})+$/.test(bare) || /^\d{1,3}(,\d{3})+$/.test(bare)
    const normal = grouped ? bare.replace(/[.,]/g, "") : bare.replace(",", ".")
    const parsed = Number(normal)
    return Number.isFinite(parsed) ? parsed : fallback
}

/** Whether a stock status passes a filter. */
export const stockMatchesFilter = (filter: StockFilter, status: StockStatus): boolean =>
    filter === "all" || filter === status

/** The step of the quick change buttons: 1 for counted goods, bigger for grams and millilitres. */
export const stepOf = (item: ItemView): number => {
    const basis = item.reorderQty || item.reorderPoint
    return basis <= STEP_BASIS_MAX ? 1 : 10 ** Math.floor(Math.log10(basis / 10))
}

/** The other units of an item as the text the form edits: "box=24, kg=1000". */
export const unitsText = (item: ItemView): string =>
    item.units.map((entry) => `${entry.unit}=${entry.factor}`).join(", ")

/** The list with the entry at `index` changed by `patch`; the other entries are kept as they are. */
export const changeAt = <Entry>(
    entries: ReadonlyArray<Entry>,
    index: number,
    patch: Partial<Entry>,
): ReadonlyArray<Entry> => entries.map((entry, at) => (at === index ? { ...entry, ...patch } : entry))

/** Opens the drawer on the entry with the given id; an unknown id opens nothing. */
export const openById =
    <Entry extends { readonly id: string }>(entries: ReadonlyArray<Entry>, open: (entry: Entry) => void) =>
    (id: string): void => {
        const entry = entries.find((candidate) => candidate.id === id)
        if (entry !== undefined) open(entry)
    }

/** Whether a text contains the needle, ignoring case; an empty needle matches everything. */
export const includesText = (text: string, needle: string): boolean => {
    const wanted = needle.trim().toLowerCase()
    return wanted === "" || text.toLowerCase().includes(wanted)
}

/** The fields of the item form, as typed. */
export interface ItemFormValues {
    readonly sku: string
    readonly name: string
    readonly unit: string
    readonly units: string
    readonly category: string
    readonly cost: string
    readonly sell: string
    readonly reorderPoint: string
    readonly reorderQty: string
    readonly supplierId: string
    readonly aliases: string
    readonly openingQty: string
}

/** The field names the item form changes one at a time. */
export type ItemFormField = keyof ItemFormValues

/** The fields of the supplier form, as typed. */
export interface SupplierFormValues {
    readonly name: string
    readonly contactName: string
    readonly email: string
    readonly phone: string
    readonly zalo: string
    readonly channel: string
    readonly leadTime: string
    readonly terms: string
    readonly note: string
}

/** The field names the supplier form changes one at a time. */
export type SupplierFormField = keyof SupplierFormValues

/** Data and formatting needed for an item summary. */
interface StockDetailInput {
    readonly board: Pick<InventoryWorkbenchData, "locations" | "suppliers">
    readonly format: ReturnType<typeof useInventoryFormat>
    readonly t: ReturnType<typeof useTranslations<"workbenchInventory">>
}

/** Item identity, supplier, location totals and replenishment details. */
export const stockDetailOf = (item: ItemView, { board, format, t }: StockDetailInput): string => {
    const placeName = (id: string): string => board.locations.find((location) => location.id === id)?.name ?? ""
    return [
        item.sku,
        item.category,
        board.suppliers.find((supplier) => supplier.id === item.supplierId)?.name ?? "",
        board.locations.length > 1
            ? item.levels.map((level) => `${placeName(level.locationId)} ${format.qty(level.qty)}`).join(", ")
            : "",
        item.reorderPoint > 0 ? t("stockMin", { qty: format.qty(item.reorderPoint) }) : "",
        item.costVnd > 0 ? t("stockCost", { cost: format.money(item.costVnd), unit: item.unit }) : "",
    ]
        .filter((part) => part !== "")
        .join(" · ")
}
