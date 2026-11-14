import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentToolsQuery, AgentToolsQueryVariables } from "../__generated__/graphql"

/** Generated input of the agentTools query. */
type QueryAgentToolsRequest = WireInput<AgentToolsQueryVariables["input"]>

/** Generated response of the agentTools query. */
type QueryAgentToolsResponse = AgentToolsQuery

type Document = TypedDocumentNode<QueryAgentToolsResponse, InputVariables<QueryAgentToolsRequest>>

const query1: Document = gql`
    query AgentTools($input: AgentIdInput!) {
        agentTools(input: $input) {
            id
            title {
                vi
                en
            }
            summary {
                vi
                en
            }
            kind
            origin
            ready
            accounts {
                connectionId
                provider
                accountLabel
            }
        }
    }
`

enum QueryAgentToolsDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentToolsDocument, Document> = {
    [QueryAgentToolsDocument.Query1]: query1,
}

type QueryAgentToolsParams = QueryParams<QueryAgentToolsDocument, QueryAgentToolsRequest> & {
    request: QueryAgentToolsRequest
}

/**
 * The tools one agent may call (owner or manager): its module's declared tools, then the provider tools its attached accounts serve, then the
 * default context reads, each with its kind, whether it is callable now and the accounts that carry it.
 * Rejects with the back end failure.
 */
export const queryAgentTools = async ({
    query = QueryAgentToolsDocument.Query1,
    request,
    signal,
}: QueryAgentToolsParams): Promise<ApolloClient.QueryResult<QueryAgentToolsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
