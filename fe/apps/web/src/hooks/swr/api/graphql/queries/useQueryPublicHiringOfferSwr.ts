"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryPublicHiringOffer } from "@/modules/api/graphql/queries/query-public-hiring-offer"
import type { QueryPublicHiringOfferRequest } from "@/modules/api/graphql/queries/query-public-hiring-offer"

/** The SWR key of the `publicHiringOffer` query. */
export const QUERY_PUBLIC_HIRING_OFFER_SWR_KEY = "QUERY_PUBLIC_HIRING_OFFER_SWR"

/** The `publicHiringOffer` query through SWR; `undefined` suspends the read. */
export const useQueryPublicHiringOfferSwr = (request: QueryPublicHiringOfferRequest | undefined) =>
    useSWR(
        argumentKey(QUERY_PUBLIC_HIRING_OFFER_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryPublicHiringOffer({ request: input }), QUERY_PUBLIC_HIRING_OFFER_SWR_KEY)
                .publicHiringOffer,
    )
