import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { BillingPlanQuoteQuery, BillingPlanQuoteQueryVariables } from "../__generated__/graphql"

/** The plan selection to price. */
export type QueryBillingPlanQuoteRequest = WireInput<BillingPlanQuoteQueryVariables["input"]>

type QueryBillingPlanQuoteResponse = BillingPlanQuoteQuery

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
}: QueryBillingPlanQuoteParams): Promise<ApolloClient.QueryResult<QueryBillingPlanQuoteResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
