import useSWR from "swr"
import { queryBillingStorage } from "@/modules/api/graphql/queries/query-billing-storage"

/** Cache identity of billingStorage within a workspace. */
export const QUERY_BILLING_STORAGE_SWR_KEY = "QUERY_BILLING_STORAGE_SWR"

/** Reads billingStorage for the selected workspace. */
export const useQueryBillingStorageSwr = (workspaceId: string | undefined) =>
    useSWR(workspaceId === undefined ? null : [QUERY_BILLING_STORAGE_SWR_KEY, workspaceId], async () => {
        const result = await queryBillingStorage()
        if (!result.data) throw new Error("billingStorage answered no data")
        return result.data.billingStorage
    })
