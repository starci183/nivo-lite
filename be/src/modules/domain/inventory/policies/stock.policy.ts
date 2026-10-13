import type { ReorderRule, StockStatus } from "../inventory.contracts"

/** An adjustment worth this much money or less is applied at once. */
export const SMALL_ADJUST_VND = 200_000

/** An adjustment of an item with no cost is small when it moves this many units or fewer. */
export const SMALL_ADJUST_QTY_NO_COST = 5

/** Out: nothing left. Low: at or below the reorder point (only when one is set). Over: far above what is needed. */
export const stockStatus = (rule: ReorderRule, total: number): StockStatus => {
    if (total <= 0) return "out"
    if (rule.reorderPoint > 0 && total <= rule.reorderPoint) return "low"
    const step = rule.reorderQty > 0 ? rule.reorderQty : rule.reorderPoint
    const ceiling = rule.reorderPoint > 0 ? rule.reorderPoint + 2 * step : 0
    return ceiling > 0 && total > ceiling ? "over" : "ok"
}

/** How much to order for an item at `total`: the usual order quantity, else enough to reach twice the reorder point. */
export const suggestOrderQty = (rule: ReorderRule, total: number): number => {
    if (rule.reorderQty > 0) return rule.reorderQty
    return Math.max(1, Math.ceil(rule.reorderPoint * 2 - Math.max(total, 0)))
}

/** True when a stock change is small enough to apply without asking the owner. */
export const isSmallAdjustment = (delta: number, costVnd: number): boolean =>
    costVnd > 0 ? Math.abs(delta) * costVnd <= SMALL_ADJUST_VND : Math.abs(delta) <= SMALL_ADJUST_QTY_NO_COST
