import type { DraftLowStockOutput } from "@modules/domain/inventory"
import type { DraftLowStockResponse } from "./dto/draft-low-stock.response"

/** Maps the draft-low-stock result to the HTTP response. */
export const toDraftLowStockResponse = (result: DraftLowStockOutput): DraftLowStockResponse => ({
    drafted: result.drafted,
    low: result.low,
})
