import type { ListFreeTimesRequest, ListFreeTimesResult } from "../../application/list-free-times.contracts"
import type { PublicBookingTimesInput } from "./dto/public-booking-times.input"
import type { PublicBookingTimesType } from "./dto/public-booking-times.type"

/** Maps the GraphQL selection to the existing free-times query. */
export const toPublicBookingTimesRequest = (input: PublicBookingTimesInput): ListFreeTimesRequest => ({
    slug: input.slug,
    service: input.serviceId,
    date: input.date,
    party: input.party,
})

/** Maps the available starts to the GraphQL view. */
export const toPublicBookingTimesType = (result: ListFreeTimesResult): PublicBookingTimesType => ({
    times: [...result.times],
})
