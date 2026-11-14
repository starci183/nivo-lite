import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentGraphLayoutQuery, AgentGraphLayoutQueryVariables } from "../__generated__/graphql"

/** The input of the `agentGraphLayout` query. */
export type QueryAgentGraphLayoutRequest = WireInput<AgentGraphLayoutQueryVariables["input"]>

type AgentGraphLayoutQueryResponse = AgentGraphLayoutQuery

const query1: TypedDocumentNode<AgentGraphLayoutQueryResponse, InputVariables<QueryAgentGraphLayoutRequest>> = gql`
    query AgentGraphLayout($input: AgentGraphLayoutInput!) {
        agentGraphLayout(input: $input) { positions { workflowKey x y } }
    }
`

enum QueryAgentGraphLayout {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentGraphLayout, TypedDocumentNode<AgentGraphLayoutQueryResponse, InputVariables<QueryAgentGraphLayoutRequest>>> = {
    [QueryAgentGraphLayout.Query1]: query1,
}

type QueryAgentGraphLayoutParams = QueryParams<QueryAgentGraphLayout, QueryAgentGraphLayoutRequest> & {
    request: QueryAgentGraphLayoutRequest
}

/** The back end `agentGraphLayout` query. Where the owner placed each workflow on the Graph page. Rejects with the back end failure (message localized by the server). */
export const queryAgentGraphLayout = async ({
    query = QueryAgentGraphLayout.Query1,
    request,
    signal,
}: QueryAgentGraphLayoutParams): Promise<ApolloClient.QueryResult<AgentGraphLayoutQueryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
