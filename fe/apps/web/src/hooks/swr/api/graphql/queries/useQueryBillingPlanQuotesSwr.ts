"use client"

import { workspaceArgumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR from "swr"
import {
    queryBillingPlanQuote,
    type QueryBillingPlanQuoteRequest,
} from "@/modules/api/graphql/queries/query-billing-plan-quote"
import type { BillingPlanQuoteQuery } from "@/modules/api"

/** Cache identity of billingPlanQuote within a workspace. */
export const QUERY_BILLING_PLAN_QUOTES_SWR_KEY = "QUERY_BILLING_PLAN_QUOTES_SWR"

/**
 * Prices several plan selections for the selected workspace. A selection the server refuses answers null in its place, so one
 * bad choice never hides the other plans.
 */
export const useQueryBillingPlanQuotesSwr = (
    workspaceId: string | undefined,
    requests: ReadonlyArray<QueryBillingPlanQuoteRequest>,
): ReadResponse<(NonNullable<BillingPlanQuoteQuery["billingPlanQuote"]> | null)[]> =>
    useSWR(
        workspaceArgumentKey(QUERY_BILLING_PLAN_QUOTES_SWR_KEY, workspaceId, JSON.stringify(requests)),
        async () =>
            Promise.all(
                requests.map(async (request) => {
                    try {
                        const result = await queryBillingPlanQuote({ request })
                        return result.data?.billingPlanQuote ?? null
                    } catch {
                        return null
                    }
                }),
            ),
        { keepPreviousData: true },
    )
