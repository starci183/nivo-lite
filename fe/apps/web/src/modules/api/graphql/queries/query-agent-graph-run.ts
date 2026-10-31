import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentGraphRunQuery, AgentGraphRunQueryVariables } from "../__generated__/graphql"

/** The input of the `agentGraphRun` query. */
export type QueryAgentGraphRunRequest = WireInput<AgentGraphRunQueryVariables["input"]>

type QueryAgentGraphRunResponse = AgentGraphRunQuery

const query1: TypedDocumentNode<QueryAgentGraphRunResponse, InputVariables<QueryAgentGraphRunRequest>> = gql`
    query AgentGraphRun($input: GetAgentGraphRunInput!) {
        agentGraphRun(input: $input) {
            agentId
            branchKey
            closedAs
            decisionId
            factsJson
            outcome
            shadowDiff
            traceJson
            trigger
            version
        }
    }
`

enum QueryAgentGraphRun {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentGraphRun,
    TypedDocumentNode<QueryAgentGraphRunResponse, InputVariables<QueryAgentGraphRunRequest>>
> = {
    [QueryAgentGraphRun.Query1]: query1,
}

type QueryAgentGraphRunParams = QueryParams<QueryAgentGraphRun, QueryAgentGraphRunRequest> & {
    request: QueryAgentGraphRunRequest
}

/** The back end `agentGraphRun` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentGraphRun = async ({
    query = QueryAgentGraphRun.Query1,
    request,
    signal,
}: QueryAgentGraphRunParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
