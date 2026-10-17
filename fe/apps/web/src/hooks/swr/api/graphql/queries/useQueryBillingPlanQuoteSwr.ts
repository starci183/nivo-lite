"use client"

import { argumentKey, answeredData } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryBillingPlanQuote } from "@/modules/api/graphql/queries/query-billing-plan-quote"
import type { QueryBillingPlanQuoteRequest } from "@/modules/api/graphql/queries/query-billing-plan-quote"

/** The SWR key of the billingPlanQuote query. */
export const QUERY_BILLING_PLAN_QUOTE_SWR_KEY = "QUERY_BILLING_PLAN_QUOTE_SWR"

/** Reads the quote of one plan selection through SWR; `undefined` pauses the read. */
export const useQueryBillingPlanQuoteSwr = (request: QueryBillingPlanQuoteRequest | undefined) =>
    useSWR(
        argumentKey(QUERY_BILLING_PLAN_QUOTE_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryBillingPlanQuote({ request: input }), QUERY_BILLING_PLAN_QUOTE_SWR_KEY)
                .billingPlanQuote,
    )
