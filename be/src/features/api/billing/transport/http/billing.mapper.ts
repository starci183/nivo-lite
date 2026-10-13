import type { PayableOrder } from "@modules/domain/billing"
import type { PayableOrderResponse } from "./dto/payable-order.response"

/** Maps a payable order to the HTTP response (the same shape: order, QR and bank). */
export const toPayableOrderResponse = (result: PayableOrder): PayableOrderResponse => result
