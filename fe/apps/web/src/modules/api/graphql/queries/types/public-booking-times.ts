import type { Query, QueryPublicBookingTimesArgs } from "../../__generated__/schema"

/** The input of the `publicBookingTimes` query. */
export type QueryPublicBookingTimesRequest = QueryPublicBookingTimesArgs["input"]

/** The response of the `publicBookingTimes` query. */
export type QueryPublicBookingTimesResponse = Pick<Query, "publicBookingTimes">
