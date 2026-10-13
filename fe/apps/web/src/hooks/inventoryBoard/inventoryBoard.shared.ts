import type { InventoryWorkbenchData } from "@/modules/types"

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
