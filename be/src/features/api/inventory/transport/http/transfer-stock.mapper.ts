import type { TransferStockRequest } from "../../application/transfer-stock.contracts"
import type { TransferStockOutput } from "@modules/domain/inventory"
import type { TransferStockRequest as TransferStockHttpRequest } from "./dto/transfer-stock.request"
import type { TransferStockResponse } from "./dto/transfer-stock.response"

/** Maps the HTTP request to the transfer-stock request. */
export const toTransferStockRequest = (input: TransferStockHttpRequest, workspaceId: string): TransferStockRequest => ({
    workspaceId,
    input: {
        itemId: input.itemId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        qty: input.qty,
        note: input.note,
    },
})

/** Maps the transfer-stock result to the HTTP response. */
export const toTransferStockResponse = (result: TransferStockOutput): TransferStockResponse => ({
    from: result.from,
    to: result.to,
})
