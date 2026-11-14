import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SandboxLatestRequestQuery, SandboxLatestRequestQueryVariables } from "../__generated__/graphql"

/** The response of the `sandboxLatestRequest` query: the typed payload straight from the back end contract. */
type QuerySandboxLatestRequestResponse = SandboxLatestRequestQuery

/** The variables of the `sandboxLatestRequest` query. */
export type QuerySandboxLatestRequestRequest = SandboxLatestRequestQueryVariables

type Document = TypedDocumentNode<QuerySandboxLatestRequestResponse, SandboxLatestRequestQueryVariables>

const query1: Document = gql`
    query SandboxLatestRequest($connectionId: ID!) {
        sandboxLatestRequest(connectionId: $connectionId) {
            operation
            at
            inputs {
                name
                value
            }
        }
    }
`

enum QuerySandboxLatestRequest {
    Query1 = "query1",
}

const queryMap: Record<QuerySandboxLatestRequest, Document> = { [QuerySandboxLatestRequest.Query1]: query1 }

/** Apollo params for {@link querySandboxLatestRequest}. */
type QuerySandboxLatestRequestParams = QueryParams<QuerySandboxLatestRequest, QuerySandboxLatestRequestRequest> & { request: QuerySandboxLatestRequestRequest }

/** Reads the newest request the agent logged on one sandbox account (the prefill of a send) (owner and manager); rejects with the back end failure. */
export const querySandboxLatestRequest = async ({
    query = QuerySandboxLatestRequest.Query1,
    request,
    signal,
}: QuerySandboxLatestRequestParams): Promise<ApolloClient.QueryResult<QuerySandboxLatestRequestResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: request,
        fetchPolicy: "no-cache",
    })
}
