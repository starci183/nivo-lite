import useSWR from "swr"
import { queryPublicLoyaltyPage } from "@/modules/api/graphql/queries/query-public-loyalty-page"
import type { QueryPublicLoyaltyPageRequest } from "@/modules/api/graphql/queries/types/public-loyalty-page"

/** The SWR key of the `publicLoyaltyPage` query. */
export const QUERY_PUBLIC_LOYALTY_PAGE_SWR_KEY = "QUERY_PUBLIC_LOYALTY_PAGE_SWR"

/** The public loyalty page of one shop slug (anonymous). */
export const useQueryPublicLoyaltyPageSwr = (request: QueryPublicLoyaltyPageRequest | null) =>
    useSWR(
        request === null ? null : [QUERY_PUBLIC_LOYALTY_PAGE_SWR_KEY, request],
        async (key: readonly [string, QueryPublicLoyaltyPageRequest]) => {
            const result = await queryPublicLoyaltyPage({ request: key[1] })
            if (!result.data) throw new Error("publicLoyaltyPage answered no data")
            return result.data.publicLoyaltyPage
        },
    )
