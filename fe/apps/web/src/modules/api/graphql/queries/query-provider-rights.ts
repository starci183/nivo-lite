import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ProviderRightsQuery } from "../__generated__/graphql"

/** Generated response of the providerRights query. */
type QueryProviderRightsResponse = ProviderRightsQuery

type Document = TypedDocumentNode<QueryProviderRightsResponse>

const query1: Document = gql`
    query ProviderRights {
        providerRights {
            providers {
                provider
                label { vi en }
                kind
                kindLabel { vi en }
                connected
                abilities { id label { vi en } scope tools }
            }
            attachments { agentId provider abilities { id mode } }
        }
    }
`

enum QueryProviderRightsDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryProviderRightsDocument, Document> = {
    [QueryProviderRightsDocument.Query1]: query1,
}

type QueryProviderRightsParams = QueryParams<QueryProviderRightsDocument>

/** Every provider of the shop with its abilities, and the providers attached to the agents (owner or manager). Rejects with the back end failure. */
export const queryProviderRights = async ({
    query = QueryProviderRightsDocument.Query1,
    signal,
}: QueryProviderRightsParams = {}): Promise<ApolloClient.QueryResult<QueryProviderRightsResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
