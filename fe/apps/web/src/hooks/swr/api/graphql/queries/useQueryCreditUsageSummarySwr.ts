"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryCreditUsageSummary } from "@/modules/api/graphql/queries/query-credit-usage-summary"

/** Cache identity of creditUsageSummary within a workspace. */
export const QUERY_CREDIT_USAGE_SUMMARY_SWR_KEY = "QUERY_CREDIT_USAGE_SUMMARY_SWR"

/** Reads creditUsageSummary for the selected workspace. */
export const useQueryCreditUsageSummarySwr = (workspaceId: string | undefined, enabled = true) =>
    useSWR(argumentKey(QUERY_CREDIT_USAGE_SUMMARY_SWR_KEY, workspaceId), async () => {
        const result = await queryCreditUsageSummary({})
        if (!result.data) throw new Error("creditUsageSummary answered no data")
        return result.data.creditUsageSummary
    })
