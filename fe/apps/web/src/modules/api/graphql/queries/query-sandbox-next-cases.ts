import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxNextCasesQuery, SandboxNextCasesQueryVariables } from "../__generated__/graphql"

/** The response of the `sandboxNextCases` query: the typed payload straight from the back end contract. */
type QuerySandboxNextCasesResponse = SandboxNextCasesQuery

/** The variables of the `sandboxNextCases` query. */
export type QuerySandboxNextCasesRequest = SandboxNextCasesQueryVariables

type Document = TypedDocumentNode<QuerySandboxNextCasesResponse, SandboxNextCasesQueryVariables>

const query1: Document = gql`
    query SandboxNextCases($connectionId: ID!) {
        sandboxNextCases(connectionId: $connectionId) {
            operation
            caseId
            isDefault
        }
    }
`

enum QuerySandboxNextCases {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxNextCases, Document> = { [QuerySandboxNextCases.Query1]: query1 }

/** Apollo params for {@link querySandboxNextCases}. */
type QuerySandboxNextCasesParams = QueryParams<QuerySandboxNextCases, QuerySandboxNextCasesRequest> & { request: QuerySandboxNextCasesRequest }

/** Reads the case each outbound operation of one sandbox account answers next (owner and manager); rejects with the back end failure. */
export const querySandboxNextCases = async ({
    query = QuerySandboxNextCases.Query1,
    request,
    signal,
}: QuerySandboxNextCasesParams): Promise<ApolloClient.QueryResult<QuerySandboxNextCasesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: request,
        fetchPolicy: "no-cache",
    })
}
