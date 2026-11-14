import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxWaitingRunsQuery, SandboxWaitingRunsQueryVariables } from "../__generated__/graphql"

/** The response of the `sandboxWaitingRuns` query: the typed payload straight from the back end contract. */
type QuerySandboxWaitingRunsResponse = SandboxWaitingRunsQuery

/** The variables of the `sandboxWaitingRuns` query. */
export type QuerySandboxWaitingRunsRequest = SandboxWaitingRunsQueryVariables

type Document = TypedDocumentNode<QuerySandboxWaitingRunsResponse, SandboxWaitingRunsQueryVariables>

const query1: Document = gql`
    query SandboxWaitingRuns($limit: Int) {
        sandboxWaitingRuns(limit: $limit) {
            runId
            agentId
            agentLabel
            personLabel
            routeId
            waitsFor
            parkKey
            dueAt
        }
    }
`

enum QuerySandboxWaitingRuns {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxWaitingRuns, Document> = { [QuerySandboxWaitingRuns.Query1]: query1 }

/** Apollo params for {@link querySandboxWaitingRuns}. */
type QuerySandboxWaitingRunsParams = QueryParams<QuerySandboxWaitingRuns, QuerySandboxWaitingRunsRequest> & { request: QuerySandboxWaitingRunsRequest }

/** Reads the runs of the workspace parked at a wait, newest first (owner and manager); rejects with the back end failure. */
export const querySandboxWaitingRuns = async ({
    query = QuerySandboxWaitingRuns.Query1,
    request,
    signal,
}: QuerySandboxWaitingRunsParams): Promise<ApolloClient.QueryResult<QuerySandboxWaitingRunsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: request,
        fetchPolicy: "no-cache",
    })
}
