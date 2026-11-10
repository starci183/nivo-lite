import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentWorkflowQuery, AgentWorkflowQueryVariables } from "../__generated__/graphql"

/** The input of the `agentWorkflow` query. */
export type QueryAgentWorkflowRequest = WireInput<AgentWorkflowQueryVariables["input"]>

type AgentWorkflowQueryResponse = AgentWorkflowQuery

const query1: TypedDocumentNode<AgentWorkflowQueryResponse, InputVariables<QueryAgentWorkflowRequest>> = gql`
    query AgentWorkflow($input: AgentWorkflowInput!) {
        agentWorkflow(input: $input) { workflow { id key name status primary activeNumber latestNumber templateId templateVersion templateName templateLatest templateChangedSteps stepCount updatedAt } graphJson versions { id number changeKind authorKind authorId note templateId templateVersion fromNumber publishedAt stepCount changedSteps active } templateDiff { steps { key change step parts params { name beforeJson afterJson } } triggerChanged rightsAdded rightsRemoved toolsAdded toolsRemoved effectsAdded effectsRemoved beforeJson afterJson } }
    }
`

enum QueryAgentWorkflow {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentWorkflow, TypedDocumentNode<AgentWorkflowQueryResponse, InputVariables<QueryAgentWorkflowRequest>>> = {
    [QueryAgentWorkflow.Query1]: query1,
}

type QueryAgentWorkflowParams = QueryParams<QueryAgentWorkflow, QueryAgentWorkflowRequest> & {
    request: QueryAgentWorkflowRequest
}

/** The back end `agentWorkflow` query. One workflow with the graph that runs, its history and its template diff. Rejects with the back end failure (message localized by the server). */
export const queryAgentWorkflow = async ({
    query = QueryAgentWorkflow.Query1,
    request,
    signal,
}: QueryAgentWorkflowParams): Promise<ApolloClient.QueryResult<AgentWorkflowQueryResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
