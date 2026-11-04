"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { queryBillingPlans } from "@/modules/api/graphql/queries/query-billing-plans"
import type { BillingPlansQuery } from "@/modules/api"

/** Cache identity of billingPlans. */
export const QUERY_BILLING_PLANS_SWR_KEY = "QUERY_BILLING_PLANS_SWR"

/** Reads billingPlans through the backend. */
export const useQueryBillingPlansSwr = (): SWRResponse<BillingPlansQuery["billingPlans"], Error> =>
    useSWR(QUERY_BILLING_PLANS_SWR_KEY, async () => {
        const result = await queryBillingPlans()
        if (!result.data) throw new Error("billingPlans answered no data")
        return result.data.billingPlans
    })
