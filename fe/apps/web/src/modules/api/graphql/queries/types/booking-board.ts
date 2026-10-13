import type { Query, QueryBookingBoardArgs } from "../../__generated__/schema"

/** The input of the `bookingBoard` query. */
export type QueryBookingBoardRequest = QueryBookingBoardArgs["input"]

/** The response of the `bookingBoard` query. */
export type QueryBookingBoardResponse = Pick<Query, "bookingBoard">
