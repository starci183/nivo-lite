"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import { queryPublicBookingPage } from "@/modules/api/graphql/queries/query-public-booking-page"
import type { queryPublicBookingPage as QueryPublicBookingPageOperation } from "@/modules/api/graphql/queries/query-public-booking-page"
import useSWR from "swr"

/** The input of the anonymous public booking page query. */
type PublicBookingPageRequest = Parameters<typeof QueryPublicBookingPageOperation>[0]["request"]

/** The SWR key of the public booking page query. */
export const QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY = "QUERY_PUBLIC_BOOKING_PAGE_SWR"

/** Reads the public booking page through the anonymous Apollo operation; `undefined` pauses the read. */
export const useQueryPublicBookingPageSwr = (request: PublicBookingPageRequest | undefined) =>
    useSWR(
        argumentKey(QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryPublicBookingPage({ request: input }), QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY)
                .publicBookingPage,
    )
