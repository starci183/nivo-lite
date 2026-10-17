"use client"

import { workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryCreditRecentCostUsd } from "@/modules/api/graphql/queries/query-credit-recent-cost-usd"

/** Cache identity of creditRecentCostUsd within a workspace. */
export const QUERY_CREDIT_RECENT_COST_USD_SWR_KEY = "QUERY_CREDIT_RECENT_COST_USD_SWR"

/** Reads creditRecentCostUsd for the selected workspace. */
export const useQueryCreditRecentCostUsdSwr = (workspaceId: string | undefined, from: string) =>
    useSWR(workspaceArgumentKey(QUERY_CREDIT_RECENT_COST_USD_SWR_KEY, workspaceId, from), async () => {
        const result = await queryCreditRecentCostUsd({
            request: { from },
        })
        if (!result.data) throw new Error("creditRecentCostUsd answered no data")
        return result.data.creditRecentCostUsd
    })
