import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CreditPacksQuery } from "../__generated__/graphql"

type QueryCreditPacksResponse = CreditPacksQuery

const query1: TypedDocumentNode<QueryCreditPacksResponse> = gql`
    query CreditPacks {
        creditPacks {
            code
            credits
            priceVnd
            sort
        }
    }
`

/** The available creditPacks documents. */
enum QueryCreditPacks {
    Query1 = "query1",
}

const queryMap: Record<QueryCreditPacks, typeof query1> = { [QueryCreditPacks.Query1]: query1 }

/** Reads creditPacks through the authenticated GraphQL client. */
export const queryCreditPacks = async ({
    query = QueryCreditPacks.Query1,
    signal,
}: QueryParams<QueryCreditPacks> = {}): Promise<ApolloClient.QueryResult<QueryCreditPacksResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
