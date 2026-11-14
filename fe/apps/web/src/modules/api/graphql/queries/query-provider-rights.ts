import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ProviderRightsQuery } from "../__generated__/graphql"

/** Generated response of the providerRights query. */
type QueryProviderRightsResponse = ProviderRightsQuery

type Document = TypedDocumentNode<QueryProviderRightsResponse>

const query1: Document = gql`
    query ProviderRights {
        providerRights {
            providers {
                provider
                label {
                    vi
                    en
                }
                kind
                kindLabel {
                    vi
                    en
                }
                connected
                tools
                accounts {
                    connectionId
                    provider
                    kind
                    accountLabel
                    connected
                }
            }
            attachments {
                agentId
                connectionId
                provider
            }
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

/** Every provider of the shop with the tools it serves and its connected accounts, and the accounts attached to the agents (owner or manager). Rejects with the back end failure. */
export const queryProviderRights = async ({
    query = QueryProviderRightsDocument.Query1,
    signal,
}: QueryProviderRightsParams = {}): Promise<ApolloClient.QueryResult<QueryProviderRightsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
