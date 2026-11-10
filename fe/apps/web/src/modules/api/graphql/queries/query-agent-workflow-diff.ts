import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentWorkflowDiffQuery, AgentWorkflowDiffQueryVariables } from "../__generated__/graphql"

/** The input of the `agentWorkflowDiff` query. */
export type QueryAgentWorkflowDiffRequest = WireInput<AgentWorkflowDiffQueryVariables["input"]>

type AgentWorkflowDiffQueryResponse = AgentWorkflowDiffQuery

const query1: TypedDocumentNode<AgentWorkflowDiffQueryResponse, InputVariables<QueryAgentWorkflowDiffRequest>> = gql`
    query AgentWorkflowDiff($input: AgentWorkflowDiffInput!) {
        agentWorkflowDiff(input: $input) { steps { key change step parts params { name beforeJson afterJson } } triggerChanged rightsAdded rightsRemoved toolsAdded toolsRemoved effectsAdded effectsRemoved beforeJson afterJson }
    }
`

enum QueryAgentWorkflowDiff {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentWorkflowDiff, TypedDocumentNode<AgentWorkflowDiffQueryResponse, InputVariables<QueryAgentWorkflowDiffRequest>>> = {
    [QueryAgentWorkflowDiff.Query1]: query1,
}

type QueryAgentWorkflowDiffParams = QueryParams<QueryAgentWorkflowDiff, QueryAgentWorkflowDiffRequest> & {
    request: QueryAgentWorkflowDiffRequest
}

/** The back end `agentWorkflowDiff` query. How a workflow version differs from the previous one, another one or the template. Rejects with the back end failure (message localized by the server). */
export const queryAgentWorkflowDiff = async ({
    query = QueryAgentWorkflowDiff.Query1,
    request,
    signal,
}: QueryAgentWorkflowDiffParams): Promise<ApolloClient.QueryResult<AgentWorkflowDiffQueryResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
