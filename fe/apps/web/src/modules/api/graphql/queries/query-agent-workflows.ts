import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentWorkflowsQuery, AgentWorkflowsQueryVariables } from "../__generated__/graphql"

/** The input of the `agentWorkflows` query. */
export type QueryAgentWorkflowsRequest = WireInput<AgentWorkflowsQueryVariables["input"]>

type AgentWorkflowsQueryResponse = AgentWorkflowsQuery

const query1: TypedDocumentNode<AgentWorkflowsQueryResponse, InputVariables<QueryAgentWorkflowsRequest>> = gql`
    query AgentWorkflows($input: AgentWorkflowsInput!) {
        agentWorkflows(input: $input) {
            id
            key
            name
            status
            primary
            activeNumber
            latestNumber
            templateId
            templateVersion
            templateName
            templateLatest
            templateChangedSteps
            stepCount
            updatedAt
            readiness {
                hidden
                waitingFor
                skipped
                reconnect {
                    provider
                    connectionId
                }
                blocked {
                    provider
                    reason
                    stream
                    connectionIds
                }
            }
        }
    }
`

enum QueryAgentWorkflows {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentWorkflows, TypedDocumentNode<AgentWorkflowsQueryResponse, InputVariables<QueryAgentWorkflowsRequest>>> = {
    [QueryAgentWorkflows.Query1]: query1,
}

type QueryAgentWorkflowsParams = QueryParams<QueryAgentWorkflows, QueryAgentWorkflowsRequest> & {
    request: QueryAgentWorkflowsRequest
}

/** The back end `agentWorkflows` query. The workflows of one agent. Rejects with the back end failure (message localized by the server). */
export const queryAgentWorkflows = async ({
    query = QueryAgentWorkflows.Query1,
    request,
    signal,
}: QueryAgentWorkflowsParams): Promise<ApolloClient.QueryResult<AgentWorkflowsQueryResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
