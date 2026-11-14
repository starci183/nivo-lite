import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentRunWorkflowsQuery, AgentRunWorkflowsQueryVariables } from "../__generated__/graphql"

/** The input of the `agentRunWorkflows` query. */
export type QueryAgentRunWorkflowsRequest = WireInput<AgentRunWorkflowsQueryVariables["input"]>

type AgentRunWorkflowsQueryResponse = AgentRunWorkflowsQuery

const query1: TypedDocumentNode<AgentRunWorkflowsQueryResponse, InputVariables<QueryAgentRunWorkflowsRequest>> = gql`
    query AgentRunWorkflows($input: AgentRunWorkflowsInput!) {
        agentRunWorkflows(input: $input) { runId workflowId workflowName version }
    }
`

enum QueryAgentRunWorkflows {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentRunWorkflows, TypedDocumentNode<AgentRunWorkflowsQueryResponse, InputVariables<QueryAgentRunWorkflowsRequest>>> = {
    [QueryAgentRunWorkflows.Query1]: query1,
}

type QueryAgentRunWorkflowsParams = QueryParams<QueryAgentRunWorkflows, QueryAgentRunWorkflowsRequest> & {
    request: QueryAgentRunWorkflowsRequest
}

/** The back end `agentRunWorkflows` query. The workflow and version each run executes. Rejects with the back end failure (message localized by the server). */
export const queryAgentRunWorkflows = async ({
    query = QueryAgentRunWorkflows.Query1,
    request,
    signal,
}: QueryAgentRunWorkflowsParams): Promise<ApolloClient.QueryResult<AgentRunWorkflowsQueryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
