import type { DeductOrderRequest } from "../../application/deduct-order.contracts"
import type { DeductOrderRequest as DeductOrderHttpRequest } from "./dto/deduct-order.request"

/** Maps the HTTP request to the deduct-order request. */
export const toDeductOrderRequest = (input: DeductOrderHttpRequest, workspaceId: string): DeductOrderRequest => ({
    workspaceId,
    input: {
        orderId: input.orderId,
        orderNo: input.orderNo,
        items: input.items,
    },
})
