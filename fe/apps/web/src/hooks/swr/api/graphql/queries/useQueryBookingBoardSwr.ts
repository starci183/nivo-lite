"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryBookingBoard } from "@/modules/api/graphql/queries/query-booking-board"
import type { QueryBookingBoardRequest } from "@/modules/api/graphql/queries/types/booking-board"

/** The SWR key of the `bookingBoard` query. */
export const QUERY_BOOKING_BOARD_SWR_KEY = "QUERY_BOOKING_BOARD_SWR"

/** The booking workbench board of one range of dates (an empty request answers the current week of the workspace timezone). */
export const useQueryBookingBoardSwr = (request?: QueryBookingBoardRequest | null, config?: SWRConfiguration) =>
    useSWR(
        [QUERY_BOOKING_BOARD_SWR_KEY, request ?? null],
        async (key: readonly [string, QueryBookingBoardRequest | null]) => {
            const result = await queryBookingBoard({ request: key[1] ?? {} })
            if (!result.data) throw new Error("bookingBoard answered no data")
            return result.data.bookingBoard
        },
        config,
    )
