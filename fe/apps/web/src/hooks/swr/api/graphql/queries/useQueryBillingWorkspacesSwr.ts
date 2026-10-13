import useSWR from "swr"
import { queryBillingWorkspaces } from "@/modules/api/graphql/queries/query-billing-workspaces"

/** Cache identity of billingWorkspaces. */
export const QUERY_BILLING_WORKSPACES_SWR_KEY = "QUERY_BILLING_WORKSPACES_SWR"

/** Reads billingWorkspaces through the backend. */
export const useQueryBillingWorkspacesSwr = () =>
    useSWR(QUERY_BILLING_WORKSPACES_SWR_KEY, async () => {
        const result = await queryBillingWorkspaces()
        if (!result.data) throw new Error("billingWorkspaces answered no data")
        return result.data.billingWorkspaces
    })
