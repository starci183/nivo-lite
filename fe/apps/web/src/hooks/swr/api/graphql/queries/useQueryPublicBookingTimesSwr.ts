"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryPublicBookingTimes } from "@/modules/api/graphql/queries/query-public-booking-times"
import type { QueryPublicBookingTimesRequest } from "@/modules/api/graphql/queries/types/public-booking-times"

/** The SWR key of the `publicBookingTimes` query. */
export const QUERY_PUBLIC_BOOKING_TIMES_SWR_KEY = "QUERY_PUBLIC_BOOKING_TIMES_SWR"

/** The free start times of one service on one day of the public booking page. */
export const useQueryPublicBookingTimesSwr = (
    request: QueryPublicBookingTimesRequest | null,
    config?: SWRConfiguration,
) =>
    useSWR(
        request === null ? null : [QUERY_PUBLIC_BOOKING_TIMES_SWR_KEY, request],
        async (key: readonly [string, QueryPublicBookingTimesRequest]) => {
            const result = await queryPublicBookingTimes({ request: key[1] })
            if (!result.data) throw new Error("publicBookingTimes answered no data")
            return result.data.publicBookingTimes
        },
        config,
    )
