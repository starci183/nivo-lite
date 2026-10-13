import useSWR from "swr"
import { queryCreditQuotaStatus } from "@/modules/api/graphql/queries/query-credit-quota-status"

/** Cache identity of creditQuotaStatus within a workspace. */
export const QUERY_CREDIT_QUOTA_STATUS_SWR_KEY = "QUERY_CREDIT_QUOTA_STATUS_SWR"

/** Reads creditQuotaStatus for the selected workspace. */
export const useQueryCreditQuotaStatusSwr = (workspaceId: string | undefined) =>
    useSWR(workspaceId === undefined ? null : [QUERY_CREDIT_QUOTA_STATUS_SWR_KEY, workspaceId], async () => {
        const result = await queryCreditQuotaStatus({
        })
        if (!result.data) throw new Error("creditQuotaStatus answered no data")
        return result.data.creditQuotaStatus ?? null
    })
