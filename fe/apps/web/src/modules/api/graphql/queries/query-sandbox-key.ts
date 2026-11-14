import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxKeyQuery, SandboxKeyQueryVariables } from "../__generated__/graphql"

/** The response of the `sandboxKey` query: the typed payload straight from the back end contract. */
type QuerySandboxKeyResponse = SandboxKeyQuery

/** The variables of the `sandboxKey` query. */
export type QuerySandboxKeyRequest = SandboxKeyQueryVariables

type Document = TypedDocumentNode<QuerySandboxKeyResponse, SandboxKeyQueryVariables>

const query1: Document = gql`
    query SandboxKey($connectionId: ID!) {
        sandboxKey(connectionId: $connectionId)
    }
`

enum QuerySandboxKey {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxKey, Document> = { [QuerySandboxKey.Query1]: query1 }

/** Apollo params for {@link querySandboxKey}. */
type QuerySandboxKeyParams = QueryParams<QuerySandboxKey, QuerySandboxKeyRequest> & { request: QuerySandboxKeyRequest }

/** Reads the sandbox key of one account (owner and manager); rejects with the back end failure. */
export const querySandboxKey = async ({
    query = QuerySandboxKey.Query1,
    request,
    signal,
}: QuerySandboxKeyParams): Promise<ApolloClient.QueryResult<QuerySandboxKeyResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: request,
        fetchPolicy: "no-cache",
    })
}
