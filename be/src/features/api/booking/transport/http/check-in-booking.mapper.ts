import type { CheckInBookingRequest, CheckInBookingResult } from "../../application/check-in-booking.contracts"
import type { CheckInBookingParamsRequest } from "./dto/check-in-booking.request"
import type { CheckInBookingResponse } from "./dto/check-in-booking.response"

/** Maps the HTTP input of check-in-booking to the command request. */
export const toCheckInBookingRequest = (params: CheckInBookingParamsRequest): CheckInBookingRequest => ({
    workspaceId: params.workspaceId,
    id: params.id,
})

/** Maps the check-in-booking result to the HTTP answer. */
export const toCheckInBookingResponse = (result: CheckInBookingResult): CheckInBookingResponse => result
