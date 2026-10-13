import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryBillingPlanQuoteArgs } from "../__generated__/schema"

/** The plan selection to price. */
export type QueryBillingPlanQuoteRequest = QueryBillingPlanQuoteArgs["input"]

type QueryBillingPlanQuoteResponse = Pick<Query, "billingPlanQuote">

type QueryBillingPlanQuoteParams = QueryParams<QueryBillingPlanQuote, QueryBillingPlanQuoteRequest> & {
    request: QueryBillingPlanQuoteRequest
}

const query1: TypedDocumentNode<QueryBillingPlanQuoteResponse, InputVariables<QueryBillingPlanQuoteRequest>> = gql`
    query BillingPlanQuote($input: BillingPlanQuoteInput!) {
        billingPlanQuote(input: $input) {
            planCode
            cycle
            months
            amountVnd
            listMonthlyVnd
            promo
            tierCredits
            seats
            creditsPerMonth
        }
    }
`

enum QueryBillingPlanQuote {
    Query1 = "query1",
}
const queryMap: Record<QueryBillingPlanQuote, typeof query1> = { [QueryBillingPlanQuote.Query1]: query1 }

/** Calls the backend billingPlanQuote query: what a plan selection costs the selected workspace. */
export const queryBillingPlanQuote = async ({
    query = QueryBillingPlanQuote.Query1,
    request,
    signal,
}: QueryBillingPlanQuoteParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
