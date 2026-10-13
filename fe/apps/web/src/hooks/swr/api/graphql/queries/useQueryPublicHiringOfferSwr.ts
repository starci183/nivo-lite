import { useKeyedQuerySwr } from "@/hooks/reuseables"
import { queryPublicHiringOffer } from "@/modules/api/graphql/queries/query-public-hiring-offer"
import type { QueryPublicHiringOfferRequest } from "@/modules/api/graphql/queries/query-public-hiring-offer"

/** The SWR key of the `publicHiringOffer` query. */
export const QUERY_PUBLIC_HIRING_OFFER_SWR_KEY = "QUERY_PUBLIC_HIRING_OFFER_SWR"

/** The `publicHiringOffer` query through SWR; `undefined` suspends the read. */
export const useQueryPublicHiringOfferSwr = (request: QueryPublicHiringOfferRequest | undefined) =>
    useKeyedQuerySwr(
        QUERY_PUBLIC_HIRING_OFFER_SWR_KEY,
        request,
        (input) => queryPublicHiringOffer({ request: input }),
        (data) => data.publicHiringOffer,
    )
