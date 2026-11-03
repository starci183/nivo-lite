import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { CreditTopupLotsQuery } from "../__generated__/graphql"

type QueryCreditTopupLotsResponse = CreditTopupLotsQuery

const query1: TypedDocumentNode<QueryCreditTopupLotsResponse> = gql`
    query CreditTopupLots {
        creditTopupLots {
            credits
            priceVnd
            purchasedAt
            expiresAt
            creditsRemaining
        }
    }
`

/** The available creditTopupLots documents. */
enum QueryCreditTopupLots {
    Query1 = "query1",
}

const queryMap: Record<QueryCreditTopupLots, typeof query1> = { [QueryCreditTopupLots.Query1]: query1 }

/** Reads creditTopupLots through the authenticated GraphQL client. */
export const queryCreditTopupLots = async ({
    query = QueryCreditTopupLots.Query1,
    signal,
}: QueryParams<QueryCreditTopupLots> = {}): Promise<ApolloClient.QueryResult<QueryCreditTopupLotsResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
