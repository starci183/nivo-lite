import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxProvidersQuery } from "../__generated__/graphql"

/** The response of the `sandboxProviders` query: the typed payload straight from the back end contract. */
type QuerySandboxProvidersResponse = SandboxProvidersQuery

type Document = TypedDocumentNode<QuerySandboxProvidersResponse>

const query1: Document = gql`
    query SandboxProviders {
        sandboxProviders
    }
`

enum QuerySandboxProviders {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxProviders, Document> = { [QuerySandboxProviders.Query1]: query1 }

/** Apollo params for {@link querySandboxProviders}. */
type QuerySandboxProvidersParams = QueryParams<QuerySandboxProviders>

/** Reads the providers a sandbox account can be opened for (owner and manager); rejects with the back end failure. */
export const querySandboxProviders = async ({
    query = QuerySandboxProviders.Query1,
    signal,
}: QuerySandboxProvidersParams = {}): Promise<ApolloClient.QueryResult<QuerySandboxProvidersResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
