"use client"

import { answeredData, argumentKey } from "@/hooks/workspaceread"
import useSWR, { type SWRResponse } from "swr"
import {
    queryBillingPlanQuote,
    type QueryBillingPlanQuoteRequest,
} from "@/modules/api/graphql/queries/query-billing-plan-quote"
import type { BillingPlanQuoteQuery } from "@/modules/api"

/** The SWR key of the billingPlanQuote query. */
export const QUERY_BILLING_PLAN_QUOTE_SWR_KEY = "QUERY_BILLING_PLAN_QUOTE_SWR"

/** Reads the quote of one plan selection through SWR; `undefined` pauses the read. */
export const useQueryBillingPlanQuoteSwr = (
    request: QueryBillingPlanQuoteRequest | undefined,
): SWRResponse<BillingPlanQuoteQuery["billingPlanQuote"], Error> =>
    useSWR(
        argumentKey(QUERY_BILLING_PLAN_QUOTE_SWR_KEY, request),
        async ([, input]: readonly [string, NonNullable<typeof request>]) =>
            answeredData(await queryBillingPlanQuote({ request: input }), QUERY_BILLING_PLAN_QUOTE_SWR_KEY)
                .billingPlanQuote,
    )
