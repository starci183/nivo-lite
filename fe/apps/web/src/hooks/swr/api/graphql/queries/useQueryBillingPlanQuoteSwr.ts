"use client"

import { useKeyedQuerySwr } from "@/hooks/reuseables"
import { queryBillingPlanQuote } from "@/modules/api/graphql/queries/query-billing-plan-quote"
import type { QueryBillingPlanQuoteRequest } from "@/modules/api/graphql/queries/query-billing-plan-quote"

/** The SWR key of the billingPlanQuote query. */
export const QUERY_BILLING_PLAN_QUOTE_SWR_KEY = "QUERY_BILLING_PLAN_QUOTE_SWR"

/** Reads the quote of one plan selection through SWR; `undefined` pauses the read. */
export const useQueryBillingPlanQuoteSwr = (request: QueryBillingPlanQuoteRequest | undefined) =>
    useKeyedQuerySwr(
        QUERY_BILLING_PLAN_QUOTE_SWR_KEY,
        request,
        (input) => queryBillingPlanQuote({ request: input }),
        (data) => data.billingPlanQuote,
    )
