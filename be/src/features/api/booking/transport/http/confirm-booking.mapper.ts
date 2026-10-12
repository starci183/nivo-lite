import type { ConfirmBookingRequest, ConfirmBookingResult } from "../../application/confirm-booking.contracts"
import type { ConfirmBookingParamsRequest } from "./dto/confirm-booking.request"
import type { ConfirmBookingResponse } from "./dto/confirm-booking.response"

/** Maps the HTTP input of confirm-booking to the command request. */
export const toConfirmBookingRequest = (params: ConfirmBookingParamsRequest): ConfirmBookingRequest => ({
    workspaceId: params.workspaceId,
    id: params.id,
})

/** Maps the confirm-booking result to the HTTP answer. */
export const toConfirmBookingResponse = (result: ConfirmBookingResult): ConfirmBookingResponse => ({
    status: result.status,
    feeDue: result.feeDue,
})
