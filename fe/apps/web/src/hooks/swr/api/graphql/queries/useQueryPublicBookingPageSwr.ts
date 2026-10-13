import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryPublicBookingPage } from "@/modules/api/graphql/queries"
import type { QueryPublicBookingPageRequest } from "@/modules/api/graphql/queries/types/public-booking-page"

/** The SWR key of the `publicBookingPage` query; mutations that change it match it with {@link isQueryPublicBookingPageSwrKey}. */
export const QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY = "QUERY_PUBLIC_BOOKING_PAGE_SWR"

/** Matches every key of `publicBookingPage` (the plain key and the argument tuples), for SWR mutate revalidation. */
export const isQueryPublicBookingPageSwrKey = (key: unknown): boolean =>
    key === QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY || (Array.isArray(key) && key[0] === QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY)

/** The public booking page of one shop slug (anonymous: no token, no workspace). */
export const useQueryPublicBookingPageSwr = (request: QueryPublicBookingPageRequest | null, config?: SWRConfiguration) =>
    useSWR(request === null ? null : [QUERY_PUBLIC_BOOKING_PAGE_SWR_KEY, request], async (key: readonly [string, QueryPublicBookingPageRequest]) => {
        const result = await queryPublicBookingPage({ request: key[1] })
        if (!result.data) throw new Error("publicBookingPage answered no data")
        return result.data.publicBookingPage
    }, config)
