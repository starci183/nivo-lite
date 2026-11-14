import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ProviderSandboxQuery } from "../__generated__/graphql"

/** The response of the `providerSandbox` query: the typed payload straight from the back end contract. */
type QueryProviderSandboxResponse = ProviderSandboxQuery

type Document = TypedDocumentNode<QueryProviderSandboxResponse>

const query1: Document = gql`
    query ProviderSandbox {
        providerSandbox {
            enabled
        }
    }
`

enum QueryProviderSandbox {
    Query1 = "query1",
}

const queryMap: Record<QueryProviderSandbox, Document> = { [QueryProviderSandbox.Query1]: query1 }

/** Apollo params for {@link queryProviderSandbox}. */
type QueryProviderSandboxParams = QueryParams<QueryProviderSandbox>

/** Reads whether the dev switch of the sandbox is on; rejects with the back end failure. */
export const queryProviderSandbox = async ({
    query = QueryProviderSandbox.Query1,
    signal,
}: QueryProviderSandboxParams = {}): Promise<ApolloClient.QueryResult<QueryProviderSandboxResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
