"use client"

import useSWR from "swr"
import { queryCreditPacks } from "@/modules/api/graphql/queries/query-credit-packs"

/** Cache identity of the credit-pack catalogue. */
export const QUERY_CREDIT_PACKS_SWR_KEY = "QUERY_CREDIT_PACKS_SWR"

/** Reads the packs available for top-up. */
export const useQueryCreditPacksSwr = () =>
    useSWR(QUERY_CREDIT_PACKS_SWR_KEY, async () => {
        const result = await queryCreditPacks()
        if (!result.data) throw new Error("creditPacks answered no data")
        return result.data.creditPacks
    })
