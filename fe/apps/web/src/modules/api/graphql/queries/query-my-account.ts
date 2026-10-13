import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { MyAccountQuery } from "../__generated__/graphql"

/** The response of the `myAccount` query: the typed payload straight from the back end contract. */
type QueryMyAccountResponse = MyAccountQuery

type Document = TypedDocumentNode<QueryMyAccountResponse, Record<string, never>>

const query1: Document = gql`
    query MyAccount {
        myAccount {
            avatarUrl
            email
            name
            providers
            sessions {
                id
                createdAt
                ip
                isCurrent
                lastActiveAt
                userAgent
            }
        }
    }
`

enum QueryMyAccount {
    Query1 = "query1",
}

const queryMap: Record<QueryMyAccount, Document> = {
    [QueryMyAccount.Query1]: query1,
}

/** Apollo params for {@link queryMyAccount}. */
type QueryMyAccountParams = QueryParams<QueryMyAccount>

/** The signed-in account: profile, linked sign-in methods and device sessions (the back end `myAccount` query). Rejects with the back end failure instead of answering partial data. */
export const queryMyAccount = async ({ query = QueryMyAccount.Query1, signal }: QueryMyAccountParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
