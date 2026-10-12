import type { StockTakeRequest } from "../../application/stock-take.contracts"
import type { StockTakeOutput } from "@modules/domain/inventory"
import type { StockTakeRequest as StockTakeHttpRequest } from "./dto/stock-take.request"
import type { StockTakeResponse } from "./dto/stock-take.response"

/** Maps the HTTP request to the stock-take request. */
export const toStockTakeRequest = (input: StockTakeHttpRequest, workspaceId: string): StockTakeRequest => ({
    workspaceId,
    input: {
        counts: input.counts.map((item) => ({ itemId: item.itemId, counted: item.counted })),
    },
})

/** Maps the stock-take result to the HTTP response. */
export const toStockTakeResponse = (result: StockTakeOutput): StockTakeResponse => ({
    applied: result.applied,
    waiting: result.waiting,
    same: result.same,
})
