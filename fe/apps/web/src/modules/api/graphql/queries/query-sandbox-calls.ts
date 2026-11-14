import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxCallsQuery, SandboxCallsQueryVariables } from "../__generated__/graphql"

/** The response of the `sandboxCalls` query: the typed payload straight from the back end contract. */
type QuerySandboxCallsResponse = SandboxCallsQuery

/** The variables of the `sandboxCalls` query. */
export type QuerySandboxCallsRequest = SandboxCallsQueryVariables

type Document = TypedDocumentNode<QuerySandboxCallsResponse, SandboxCallsQueryVariables>

const query1: Document = gql`
    query SandboxCalls($connectionId: ID!) {
        sandboxCalls(connectionId: $connectionId) {
            id
            operation
            key
            at
            outcome
            error
            requestJson
            answerJson
        }
    }
`

enum QuerySandboxCalls {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxCalls, Document> = { [QuerySandboxCalls.Query1]: query1 }

/** Apollo params for {@link querySandboxCalls}. */
type QuerySandboxCallsParams = QueryParams<QuerySandboxCalls, QuerySandboxCallsRequest> & { request: QuerySandboxCallsRequest }

/** Reads the call log of one sandbox account, oldest first (owner and manager); rejects with the back end failure. */
export const querySandboxCalls = async ({
    query = QuerySandboxCalls.Query1,
    request,
    signal,
}: QuerySandboxCallsParams): Promise<ApolloClient.QueryResult<QuerySandboxCallsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: request,
        fetchPolicy: "no-cache",
    })
}
