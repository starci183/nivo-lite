import type { CreatePoOutput, DraftLowStockOutput, ReceivePoOutput, RequestSendOutput } from "@modules/domain/inventory"
import type { CancelInventoryPoRequest } from "../../application/cancel-inventory-po.contracts"
import type { CreateInventoryPoRequest } from "../../application/create-inventory-po.contracts"
import type { DraftInventoryLowStockRequest } from "../../application/draft-inventory-low-stock.contracts"
import type { ReceiveInventoryPoRequest } from "../../application/receive-inventory-po.contracts"
import type { RequestInventorySendRequest } from "../../application/request-inventory-send.contracts"
import type { UpdateInventoryPoDraftRequest } from "../../application/update-inventory-po-draft.contracts"
import type { CreateInventoryPoInput } from "./dto/create-inventory-po.input"
import type { DraftLowStockType } from "./dto/draft-low-stock.type"
import type { InventoryPoRefInput } from "./dto/inventory-po-ref.input"
import type { InventoryRefType } from "./dto/inventory-ref.type"
import type { ReceiveInventoryPoInput } from "./dto/receive-inventory-po.input"
import type { ReceivePoType } from "./dto/receive-po.type"
import type { RequestInventorySendInput } from "./dto/request-inventory-send.input"
import type { RequestSendType } from "./dto/request-send.type"
import type { UpdateInventoryPoDraftInput } from "./dto/update-inventory-po-draft.input"

/** Maps the workspace scope to the low-stock drafting request. */
export const toDraftInventoryLowStockRequest = (workspaceId: string): DraftInventoryLowStockRequest => ({ workspaceId })

/** Maps the GraphQL input to the purchase order create request of the workspace it names. */
export const toCreateInventoryPoRequest = (
    workspaceId: string,
    input: CreateInventoryPoInput,
): CreateInventoryPoRequest => ({
    workspaceId,
    ...input,
})

/** Maps the GraphQL input to the draft purchase order edit request of the workspace it names. */
export const toUpdateInventoryPoDraftRequest = (
    workspaceId: string,
    input: UpdateInventoryPoDraftInput,
): UpdateInventoryPoDraftRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the send request of the workspace it names. */
export const toRequestInventorySendRequest = (
    workspaceId: string,
    input: RequestInventorySendInput,
): RequestInventorySendRequest => ({ workspaceId, ...input })

/** Maps the GraphQL input to the cancellation request of the workspace it names. */
export const toCancelInventoryPoRequest = (
    workspaceId: string,
    input: InventoryPoRefInput,
): CancelInventoryPoRequest => ({
    workspaceId,
    poId: input.poId,
})

/** Maps the GraphQL input to the receipt request of the workspace it names. */
export const toReceiveInventoryPoRequest = (
    workspaceId: string,
    input: ReceiveInventoryPoInput,
): ReceiveInventoryPoRequest => ({ workspaceId, ...input })

/** Maps the low-stock drafting outcome to the GraphQL type. */
export const toDraftLowStockType = (result: DraftLowStockOutput): DraftLowStockType => ({
    drafted: result.drafted,
    low: result.low,
})

/** Maps a purchase order id answer to the GraphQL type. */
export const toInventoryRefType = (result: CreatePoOutput): InventoryRefType => ({ id: result.id })

/** Maps the send request outcome to the GraphQL type. */
export const toRequestSendType = (result: RequestSendOutput): RequestSendType => ({ status: result.status })

/** Maps the receipt outcome to the GraphQL type. */
export const toReceivePoType = (result: ReceivePoOutput): ReceivePoType => ({
    status: result.status,
    received: result.received,
    priceChanges: [...result.priceChanges],
    payableVnd: result.payableVnd,
    handedToAccounting: result.handedToAccounting,
})
