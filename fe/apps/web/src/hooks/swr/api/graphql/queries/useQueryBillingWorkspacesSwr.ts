"use client"

import useSWR, { type SWRResponse } from "swr"
import { queryBillingWorkspaces } from "@/modules/api/graphql/queries/query-billing-workspaces"
import type { BillingWorkspacesQuery } from "@/modules/api"

/** Cache identity of billingWorkspaces. */
export const QUERY_BILLING_WORKSPACES_SWR_KEY = "QUERY_BILLING_WORKSPACES_SWR"

/** Reads billingWorkspaces through the backend. */
export const useQueryBillingWorkspacesSwr = (): SWRResponse<BillingWorkspacesQuery["billingWorkspaces"], Error> =>
    useSWR(QUERY_BILLING_WORKSPACES_SWR_KEY, async () => {
        const result = await queryBillingWorkspaces()
        if (!result.data) throw new Error("billingWorkspaces answered no data")
        return result.data.billingWorkspaces
    })
