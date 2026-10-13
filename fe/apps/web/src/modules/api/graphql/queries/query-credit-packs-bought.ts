import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { CreditPacksBoughtQuery } from "../__generated__/graphql"

type QueryCreditPacksBoughtResponse = CreditPacksBoughtQuery

const query1: TypedDocumentNode<QueryCreditPacksBoughtResponse> = gql`
    query CreditPacksBought {
        creditPacksBought {
            credits
            priceVnd
            purchasedAt
        }
    }
`

enum QueryCreditPacksBought {
    Query1 = "query1",
}
const queryMap: Record<QueryCreditPacksBought, typeof query1> = { [QueryCreditPacksBought.Query1]: query1 }

/** Reads the add-on credit packs the selected workspace paid for this month. */
export const queryCreditPacksBought = async ({
    query = QueryCreditPacksBought.Query1,
    signal,
}: QueryParams<QueryCreditPacksBought> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
