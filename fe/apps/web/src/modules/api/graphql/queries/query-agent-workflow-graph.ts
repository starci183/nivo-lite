import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentWorkflowGraphQuery, AgentWorkflowGraphQueryVariables } from "../__generated__/graphql"

/** The input of the `agentWorkflowGraph` query. */
export type QueryAgentWorkflowGraphRequest = WireInput<AgentWorkflowGraphQueryVariables["input"]>

type AgentWorkflowGraphQueryResponse = AgentWorkflowGraphQuery

const query1: TypedDocumentNode<AgentWorkflowGraphQueryResponse, InputVariables<QueryAgentWorkflowGraphRequest>> = gql`
    query AgentWorkflowGraph($input: AgentWorkflowGraphInput!) {
        agentWorkflowGraph(input: $input) {
            agentId
            agentLabel
            agentAvatar
            workflows {
                id key name status primary activeNumber entry entryLabel
                inputs { name type required }
                triggers { key sourceKind sourceLabel connectionId }
                outcomes { key label outputs { name type } }
                calls { nodeKey outcome agent agentLabel agentAvatar workflow workflowName version crossAgent }
            }
        }
    }
`

enum QueryAgentWorkflowGraph {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentWorkflowGraph, TypedDocumentNode<AgentWorkflowGraphQueryResponse, InputVariables<QueryAgentWorkflowGraphRequest>>> = {
    [QueryAgentWorkflowGraph.Query1]: query1,
}

type QueryAgentWorkflowGraphParams = QueryParams<QueryAgentWorkflowGraph, QueryAgentWorkflowGraphRequest> & {
    request: QueryAgentWorkflowGraphRequest
}

/** The back end `agentWorkflowGraph` query. The agent Graph page: every workflow of one agent. Rejects with the back end failure (message localized by the server). */
export const queryAgentWorkflowGraph = async ({
    query = QueryAgentWorkflowGraph.Query1,
    request,
    signal,
}: QueryAgentWorkflowGraphParams): Promise<ApolloClient.QueryResult<AgentWorkflowGraphQueryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
