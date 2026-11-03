import type { InventoryWorkbenchData } from "@/modules/types"
import type { Figure } from "@starci/grammar/common"

/** What the figures ribbon needs to turn a number into words: the translator and the formatter of the page. */
export interface InventoryFiguresWords {
    /** Translates a `workbenchInventory` key with optional values. */
    readonly t: (key: string, values?: Record<string, number>) => string
    /** Formats the stock value as VND. */
    readonly money: (value: number) => string
}

/** The ribbon: items under their reorder level, orders waiting, stock value and the stock-outs of the week. */
export const inventoryFigures = (data: InventoryWorkbenchData, words: InventoryFiguresWords): ReadonlyArray<Figure> => {
    const active = data.items.filter((item) => item.active)
    const below = active.filter((item) => item.reorderPoint > 0 && item.total <= item.reorderPoint).length
    const awaiting = data.pos.filter((po) => po.status === "waiting_approval").length
    return [
        {
            id: "reorder",
            term: words.t("metricReorder"),
            value: String(below),
            meta: words.t("metricReorderBasis", { n: active.length }),
        },
        {
            id: "awaiting",
            term: words.t("metricAwaiting"),
            value: String(awaiting),
            meta: words.t("metricAwaitingBasis"),
        },
        {
            id: "value",
            term: words.t("metricValue"),
            value: words.money(data.metrics.valueVnd),
            meta: words.t("metricValueBasis"),
        },
        {
            id: "stockouts",
            term: words.t("metricStockOuts"),
            value: data.stockOuts7d === null ? "-" : String(data.stockOuts7d),
            meta: words.t(data.stockOuts7d === null ? "metricStockOutsUnknown" : "metricStockOutsBasis"),
        },
    ]
}

/** A ready inventory panel receives real board data and its actual display lifetime. */
export interface InventoryPanelInput {
    readonly board: InventoryWorkbenchData
    readonly isActive: boolean
    readonly scope: string
}

/** The board before the first read lands: nothing to show, nothing to manage. */
export const EMPTY_INVENTORY_BOARD: InventoryWorkbenchData = {
    canManage: false,
    defaultLocationId: null,
    locations: [],
    suppliers: [],
    items: [],
    recipes: [],
    pos: [],
    movements: [],
    pending: [],
    metrics: { valueVnd: 0, itemCount: 0, lowCount: 0, outCount: 0, openPos: 0, pendingCount: 0 },
    stockOuts7d: null,
    nowIso: "",
}
