import type { StockTakeOutput, TransferStockOutput } from "@modules/domain/inventory"
import type { TakeInventoryStockRequest } from "../../application/take-inventory-stock.contracts"
import type { TransferInventoryStockRequest } from "../../application/transfer-inventory-stock.contracts"
import type { TakeInventoryStockInput } from "./dto/take-inventory-stock.input"
import type { TakeStockType } from "./dto/take-stock.type"
import type { TransferInventoryStockInput } from "./dto/transfer-inventory-stock.input"
import type { TransferStockType } from "./dto/transfer-stock.type"

/** Maps the GraphQL input to the stock adjustment request of the workspace it names. */
export { toAdjustInventoryStockRequest } from "@modules/domain/inventory"

/** Maps the GraphQL input to the stock take request of the workspace it names. */
export const toTakeInventoryStockRequest = (
    workspaceId: string,
    input: TakeInventoryStockInput,
): TakeInventoryStockRequest => ({ workspaceId, counts: input.counts })

/** Maps the GraphQL input to the transfer request of the workspace it names. */
export const toTransferInventoryStockRequest = (
    workspaceId: string,
    input: TransferInventoryStockInput,
): TransferInventoryStockRequest => ({ workspaceId, ...input })

/** Maps the adjustment outcome to the GraphQL type. */
export { toAdjustStockType } from "@modules/domain/inventory"

/** Maps the stock take outcome to the GraphQL type. */
export const toTakeStockType = (result: StockTakeOutput): TakeStockType => ({
    applied: result.applied,
    waiting: result.waiting,
    same: result.same,
})

/** Maps the transfer outcome to the GraphQL type. */
export const toTransferStockType = (result: TransferStockOutput): TransferStockType => ({
    from: result.from,
    to: result.to,
})
