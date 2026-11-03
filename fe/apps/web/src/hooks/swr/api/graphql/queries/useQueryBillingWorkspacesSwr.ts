"use client"

import useSWR from "swr"
import { queryBillingWorkspaces } from "@/modules/api/graphql/queries/query-billing-workspaces"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** Cache identity of billingWorkspaces. */
export const QUERY_BILLING_WORKSPACES_SWR_KEY = "QUERY_BILLING_WORKSPACES_SWR"

/** Reads billingWorkspaces through the backend. */
export const useQueryBillingWorkspacesSwr = (): ReadResponse<
    OperationData<typeof queryBillingWorkspaces>["billingWorkspaces"]
> =>
    useSWR(QUERY_BILLING_WORKSPACES_SWR_KEY, async () => {
        const result = await queryBillingWorkspaces()
        if (!result.data) throw new Error("billingWorkspaces answered no data")
        return result.data.billingWorkspaces
    })
