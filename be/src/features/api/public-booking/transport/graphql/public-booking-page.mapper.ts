import type { GetBookingPageRequest, GetBookingPageResult } from "../../application/get-booking-page.contracts"
import type { PublicBookingPageInput } from "./dto/public-booking-page.input"
import type { PublicBookingPageType } from "./dto/public-booking-page.type"

/** Maps the GraphQL slug to the existing page query. */
export const toPublicBookingPageRequest = (input: PublicBookingPageInput): GetBookingPageRequest => ({
    slug: input.slug,
})

/** Maps the published page to the GraphQL view. */
export const toPublicBookingPageType = (result: GetBookingPageResult): PublicBookingPageType => ({
    shop: result.shop,
    slug: result.slug,
    note: result.note,
    address: result.address,
    timezone: result.timezone,
    services: result.services.map((service) => ({ ...service })),
})
