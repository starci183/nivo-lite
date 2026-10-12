import type { RequestBookingRequest, RequestBookingResult } from "../../application/request-booking.contracts"
import type { RequestBookingParamsRequest, RequestBookingBodyRequest } from "./dto/request-booking.request"
import type { RequestBookingResponse } from "./dto/request-booking.response"

/** Maps the HTTP input of request-booking to the command request. */
export const toRequestBookingRequest = (
    params: RequestBookingParamsRequest,
    body: RequestBookingBodyRequest,
): RequestBookingRequest => ({
    slug: params.slug,
    serviceId: body.serviceId,
    start: body.start,
    name: body.name,
    phone: body.phone,
    email: body.email,
    party: body.party,
    note: body.note,
    token: body.token,
    website: body.website,
})

/** Maps the request-booking result to the HTTP answer. */
export const toRequestBookingResponse = (result: RequestBookingResult): RequestBookingResponse => result
