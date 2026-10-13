import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ApiKeysQuery } from "../__generated__/graphql"

/** The response of the `apiKeys` query: the typed payload straight from the back end contract. */
type QueryApiKeysResponse = ApiKeysQuery

const query1: TypedDocumentNode<QueryApiKeysResponse> = gql`
    query ApiKeys {
        apiKeys {
            id
            name
            prefix
            createdAt
            lastUsedAt
            revokedAt
        }
    }
`

enum QueryApiKeys {
    Query1 = "query1",
}

const queryMap: Record<QueryApiKeys, TypedDocumentNode<QueryApiKeysResponse>> = {
    [QueryApiKeys.Query1]: query1,
}

/** Apollo params for {@link queryApiKeys}. */
type QueryApiKeysParams = QueryParams<QueryApiKeys>

/** Lists the API keys of the active workspace, never their secrets (the back end `apiKeys` query). */
export const queryApiKeys = async ({ query = QueryApiKeys.Query1, signal }: QueryApiKeysParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
