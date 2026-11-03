"use client"

import useSWR from "swr"
import { queryBillingPlans } from "@/modules/api/graphql/queries/query-billing-plans"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** Cache identity of billingPlans. */
export const QUERY_BILLING_PLANS_SWR_KEY = "QUERY_BILLING_PLANS_SWR"

/** Reads billingPlans through the backend. */
export const useQueryBillingPlansSwr = (): ReadResponse<OperationData<typeof queryBillingPlans>["billingPlans"]> =>
    useSWR(QUERY_BILLING_PLANS_SWR_KEY, async () => {
        const result = await queryBillingPlans()
        if (!result.data) throw new Error("billingPlans answered no data")
        return result.data.billingPlans
    })
