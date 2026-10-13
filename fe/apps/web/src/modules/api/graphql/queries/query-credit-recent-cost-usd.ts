import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams, InputVariables } from "../types"
import type { Query, QueryCreditRecentCostUsdArgs } from "../__generated__/schema"

type QueryCreditRecentCostUsdResponse = Pick<Query, "creditRecentCostUsd">
type QueryCreditRecentCostUsdRequest = QueryCreditRecentCostUsdArgs["input"]

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
}: QueryCreditRecentCostUsdParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
