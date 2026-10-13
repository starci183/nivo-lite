import type { Query, QueryPublicBookingPageArgs } from "../../__generated__/schema"

/** The input of the `publicBookingPage` query. */
export type QueryPublicBookingPageRequest = QueryPublicBookingPageArgs["input"]

/** The response of the `publicBookingPage` query. */
export type QueryPublicBookingPageResponse = Pick<Query, "publicBookingPage">
