import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
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
}: QueryParams<QueryCreditPacks> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
