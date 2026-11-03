"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryCreditQuotaStatus } from "@/modules/api/graphql/queries/query-credit-quota-status"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** Cache identity of creditQuotaStatus within a workspace. */
export const QUERY_CREDIT_QUOTA_STATUS_SWR_KEY = "QUERY_CREDIT_QUOTA_STATUS_SWR"

/** Reads creditQuotaStatus for the selected workspace. */
export const useQueryCreditQuotaStatusSwr = (
    workspaceId: string | undefined,
): ReadResponse<NonNullable<OperationData<typeof queryCreditQuotaStatus>["creditQuotaStatus"]> | null> =>
    useSWR(argumentKey(QUERY_CREDIT_QUOTA_STATUS_SWR_KEY, workspaceId), async () => {
        const result = await queryCreditQuotaStatus({})
        if (!result.data) throw new Error("creditQuotaStatus answered no data")
        return result.data.creditQuotaStatus ?? null
    })
