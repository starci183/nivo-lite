import type { GetBookingPageRequest, GetBookingPageResult } from "../../application/get-booking-page.contracts"
import type { GetBookingPageParamsRequest } from "./dto/get-booking-page.request"
import type { GetBookingPageResponse } from "./dto/get-booking-page.response"

/** Maps the HTTP input of get-booking-page to the command request. */
export const toGetBookingPageRequest = (params: GetBookingPageParamsRequest): GetBookingPageRequest => ({
    slug: params.slug,
})

/** Maps the get-booking-page result to the HTTP answer. */
export const toGetBookingPageResponse = (result: GetBookingPageResult): GetBookingPageResponse => ({
    shop: result.shop,
    slug: result.slug,
    note: result.note,
    address: result.address,
    timezone: result.timezone,
    services: result.services.map((i1) => ({
        id: i1.id,
        name: i1.name,
        description: i1.description,
        durationMin: i1.durationMin,
        priceVnd: i1.priceVnd,
    })),
})
