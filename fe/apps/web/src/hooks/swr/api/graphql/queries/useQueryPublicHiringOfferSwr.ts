import useSWR from "swr"
import { queryPublicHiringOffer } from "@/modules/api/graphql/queries/query-public-hiring-offer"
import type { QueryPublicHiringOfferRequest } from "@/modules/api/graphql/queries/query-public-hiring-offer"

/** The SWR key of the `publicHiringOffer` query. */
export const QUERY_PUBLIC_HIRING_OFFER_SWR_KEY = "QUERY_PUBLIC_HIRING_OFFER_SWR"

/** The `publicHiringOffer` query through SWR; `undefined` suspends the read. */
export const useQueryPublicHiringOfferSwr = (request: QueryPublicHiringOfferRequest | undefined) =>
    useSWR(request === undefined ? null : [QUERY_PUBLIC_HIRING_OFFER_SWR_KEY, request], async ([, req]) => {
        const result = await queryPublicHiringOffer({ request: req })
        if (!result.data) throw new Error("publicHiringOffer answered no data")
        return result.data.publicHiringOffer
    })
