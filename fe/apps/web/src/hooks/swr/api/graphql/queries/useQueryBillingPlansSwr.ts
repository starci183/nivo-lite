"use client"

import useSWR from "swr"
import { queryBillingPlans } from "@/modules/api/graphql/queries/query-billing-plans"

/** Cache identity of billingPlans. */
export const QUERY_BILLING_PLANS_SWR_KEY = "QUERY_BILLING_PLANS_SWR"

/** Reads billingPlans through the backend. */
export const useQueryBillingPlansSwr = () =>
    useSWR(QUERY_BILLING_PLANS_SWR_KEY, async () => {
        const result = await queryBillingPlans()
        if (!result.data) throw new Error("billingPlans answered no data")
        return result.data.billingPlans
    })
