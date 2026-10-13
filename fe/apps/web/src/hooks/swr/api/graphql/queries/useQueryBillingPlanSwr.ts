import useSWR from "swr"
import { queryBillingPlan } from "@/modules/api/graphql/queries/query-billing-plan"

/** Cache identity of billingPlan. */
export const QUERY_BILLING_PLAN_SWR_KEY = "QUERY_BILLING_PLAN_SWR"

/** Reads billingPlan through the backend. */
export const useQueryBillingPlanSwr = (code: string | undefined) =>
    useSWR(code === undefined ? null : ([QUERY_BILLING_PLAN_SWR_KEY, code] as const), async ([, requestedCode]) => {
        const result = await queryBillingPlan({ request: { code: requestedCode } })
        if (!result.data) throw new Error("billingPlan answered no data")
        return result.data.billingPlan
    })
