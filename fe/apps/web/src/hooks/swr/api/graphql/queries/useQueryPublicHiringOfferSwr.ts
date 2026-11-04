"use client"

import { answeredData, argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRResponse } from "swr"
import {
    queryPublicHiringOffer,
    type QueryPublicHiringOfferRequest,
} from "@/modules/api/graphql/queries/query-public-hiring-offer"
import type { PublicHiringOfferQuery } from "@/modules/api"

/** The SWR key of the `publicHiringOffer` query. */
export const QUERY_PUBLIC_HIRING_OFFER_SWR_KEY = "QUERY_PUBLIC_HIRING_OFFER_SWR"

/** The `publicHiringOffer` query through SWR; `undefined` suspends the read. */
export const useQueryPublicHiringOfferSwr = (
    request: QueryPublicHiringOfferRequest | undefined,
): SWRResponse<PublicHiringOfferQuery["publicHiringOffer"], Error> =>
    useSWR(
        argumentKey(QUERY_PUBLIC_HIRING_OFFER_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryPublicHiringOffer({ request: input }), QUERY_PUBLIC_HIRING_OFFER_SWR_KEY)
                .publicHiringOffer,
    )
