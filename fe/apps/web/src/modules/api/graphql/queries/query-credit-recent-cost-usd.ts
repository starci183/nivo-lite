import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CreditRecentCostUsdQuery, CreditRecentCostUsdQueryVariables } from "../__generated__/graphql"

type QueryCreditRecentCostUsdResponse = CreditRecentCostUsdQuery
type QueryCreditRecentCostUsdRequest = WireInput<CreditRecentCostUsdQueryVariables["input"]>

type QueryCreditRecentCostUsdParams = QueryParams<QueryCreditRecentCostUsd, QueryCreditRecentCostUsdRequest> & {
    request: QueryCreditRecentCostUsdRequest
}

const query1: TypedDocumentNode<
    QueryCreditRecentCostUsdResponse,
    InputVariables<QueryCreditRecentCostUsdRequest>
> = gql`
    query CreditRecentCostUsd($input: CreditRecentCostInput!) {
        creditRecentCostUsd(input: $input)
    }
`

/** The available creditRecentCostUsd documents. */
enum QueryCreditRecentCostUsd {
    Query1 = "query1",
}

const queryMap: Record<QueryCreditRecentCostUsd, typeof query1> = { [QueryCreditRecentCostUsd.Query1]: query1 }

/** Reads creditRecentCostUsd through the authenticated GraphQL client. */
export const queryCreditRecentCostUsd = async ({
    query = QueryCreditRecentCostUsd.Query1,
    signal,
    request,
}: QueryCreditRecentCostUsdParams): Promise<ApolloClient.QueryResult<QueryCreditRecentCostUsdResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
