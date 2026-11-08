"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR, { type SWRResponse } from "swr"
import { queryBillingPlan } from "@/modules/api/graphql/queries/query-billing-plan"
import type { BillingPlanQuery } from "@/modules/api"

/** Cache identity of billingPlan. */
export const QUERY_BILLING_PLAN_SWR_KEY = "QUERY_BILLING_PLAN_SWR"

/** Reads billingPlan through the backend. */
export const useQueryBillingPlanSwr = (code: string | undefined): SWRResponse<BillingPlanQuery["billingPlan"], Error> =>
    useSWR(argumentKey(QUERY_BILLING_PLAN_SWR_KEY, code), async ([, requestedCode]) => {
        const result = await queryBillingPlan({ request: { code: requestedCode } })
        if (!result.data) throw new Error("billingPlan answered no data")
        return result.data.billingPlan
    })
