"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { queryCreditPacks } from "@/modules/api/graphql/queries/query-credit-packs"
import type { CreditPacksQuery } from "@/modules/api"

/** Cache identity of the credit-pack catalogue. */
export const QUERY_CREDIT_PACKS_SWR_KEY = "QUERY_CREDIT_PACKS_SWR"

/** Reads the packs available for top-up. */
export const useQueryCreditPacksSwr = (): SWRResponse<CreditPacksQuery["creditPacks"], Error> =>
    useSWR(QUERY_CREDIT_PACKS_SWR_KEY, async () => {
        const result = await queryCreditPacks()
        if (!result.data) throw new Error("creditPacks answered no data")
        return result.data.creditPacks
    })
