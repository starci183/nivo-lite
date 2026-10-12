import type { GetBookingPageRequest, GetBookingPageResult } from "../../application/get-booking-page.contracts"
import type { GetBookingPageParamsRequest } from "./dto/get-booking-page.request"
import type { GetBookingPageResponse } from "./dto/get-booking-page.response"

/** Maps the HTTP input of get-booking-page to the command request. */
export const toGetBookingPageRequest = (params: GetBookingPageParamsRequest): GetBookingPageRequest => ({
    slug: params.slug,
})

/** Maps the get-booking-page result to the HTTP answer. */
export const toGetBookingPageResponse = (result: GetBookingPageResult): GetBookingPageResponse => result
