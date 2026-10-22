"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryCreditTopupLots } from "@/modules/api/graphql/queries/query-credit-topup-lots"

/** Cache identity of creditTopupLots within a workspace. */
export const QUERY_CREDIT_TOPUP_LOTS_SWR_KEY = "QUERY_CREDIT_TOPUP_LOTS_SWR"

/** Reads creditTopupLots for the selected workspace; nothing is read while `enabled` is false (not a manager). */
export const useQueryCreditTopupLotsSwr = (workspaceId: string | undefined, enabled = true) =>
    useSWR(argumentKey(QUERY_CREDIT_TOPUP_LOTS_SWR_KEY, enabled ? workspaceId : undefined), async () => {
        const result = await queryCreditTopupLots({})
        if (!result.data) throw new Error("creditTopupLots answered no data")
        return result.data.creditTopupLots
    })
