"use client"

import { useKeyedQuerySwr } from "@/hooks/reuseables"
import { queryPublicBookingPage } from "@/modules/api/graphql/queries/query-public-booking-page"

/** The input of the anonymous public booking page query. */
type PublicBookingPageRequest = Parameters<typeof queryPublicBookingPage>[0]["request"]

/** The SWR key of the public booking page query. */
export const QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY = "QUERY_PUBLIC_BOOKING_PAGE_SWR"

/** Reads the public booking page through the anonymous Apollo operation; `undefined` pauses the read. */
export const useQueryPublicBookingPageSwr = (request: PublicBookingPageRequest | undefined) =>
    useKeyedQuerySwr(
        QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY,
        request,
        (input) => queryPublicBookingPage({ request: input }),
        (data) => data.publicBookingPage,
    )
