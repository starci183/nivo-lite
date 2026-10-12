import type { CancelBookingRequest, CancelBookingResult } from "../../application/cancel-booking.contracts"
import type { CancelBookingParamsRequest } from "./dto/cancel-booking.request"
import type { CancelBookingResponse } from "./dto/cancel-booking.response"

/** Maps the HTTP input of cancel-booking to the command request. */
export const toCancelBookingRequest = (params: CancelBookingParamsRequest): CancelBookingRequest => ({
    workspaceId: params.workspaceId,
    id: params.id,
})

/** Maps the cancel-booking result to the HTTP answer. */
export const toCancelBookingResponse = (result: CancelBookingResult): CancelBookingResponse => ({
    status: result.status,
    feeDue: result.feeDue,
})
