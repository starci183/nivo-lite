import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxCasesQuery, SandboxCasesQueryVariables } from "../__generated__/graphql"

/** The response of the `sandboxCases` query: the typed payload straight from the back end contract. */
type QuerySandboxCasesResponse = SandboxCasesQuery

/** The variables of the `sandboxCases` query. */
export type QuerySandboxCasesRequest = SandboxCasesQueryVariables

type Document = TypedDocumentNode<QuerySandboxCasesResponse, SandboxCasesQueryVariables>

const query1: Document = gql`
    query SandboxCases($provider: String!) {
        sandboxCases(provider: $provider) {
            id
            label
            direction
            operation
            isDefault
            trigger
            inputs {
                name
                label
                kind
                example
            }
        }
    }
`

enum QuerySandboxCases {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxCases, Document> = { [QuerySandboxCases.Query1]: query1 }

/** Apollo params for {@link querySandboxCases}. */
type QuerySandboxCasesParams = QueryParams<QuerySandboxCases, QuerySandboxCasesRequest> & { request: QuerySandboxCasesRequest }

/** Reads the hardcoded cases of one provider (owner and manager); rejects with the back end failure. */
export const querySandboxCases = async ({
    query = QuerySandboxCases.Query1,
    request,
    signal,
}: QuerySandboxCasesParams): Promise<ApolloClient.QueryResult<QuerySandboxCasesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: request,
        fetchPolicy: "no-cache",
    })
}
