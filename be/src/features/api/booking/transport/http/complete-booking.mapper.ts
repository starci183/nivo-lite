import type { CompleteBookingRequest, CompleteBookingResult } from "../../application/complete-booking.contracts"
import type { CompleteBookingParamsRequest } from "./dto/complete-booking.request"
import type { CompleteBookingResponse } from "./dto/complete-booking.response"

/** Maps the HTTP input of complete-booking to the command request. */
export const toCompleteBookingRequest = (params: CompleteBookingParamsRequest): CompleteBookingRequest => ({
    workspaceId: params.workspaceId,
    id: params.id,
})

/** Maps the complete-booking result to the HTTP answer. */
export const toCompleteBookingResponse = (result: CompleteBookingResult): CompleteBookingResponse => ({
    status: result.status,
    feeDue: result.feeDue,
})
