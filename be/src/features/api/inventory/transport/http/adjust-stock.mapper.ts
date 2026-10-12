import type { AdjustStockRequest } from "../../application/adjust-stock.contracts"
import type { AdjustStockOutput } from "@modules/domain/inventory"
import type { AdjustStockRequest as AdjustStockHttpRequest } from "./dto/adjust-stock.request"
import type { AdjustStockResponse } from "./dto/adjust-stock.response"

/** Maps the HTTP request to the adjust-stock request. */
export const toAdjustStockRequest = (input: AdjustStockHttpRequest, workspaceId: string): AdjustStockRequest => ({
    workspaceId,
    input: {
        itemId: input.itemId,
        locationId: input.locationId,
        delta: input.delta,
        counted: input.counted,
        reason: input.reason,
    },
})

/** Maps the adjust-stock result to the HTTP response. */
export const toAdjustStockResponse = (result: AdjustStockOutput): AdjustStockResponse => ({
    state: result.state,
    before: result.before,
    after: result.after,
    workItemId: result.workItemId,
})
