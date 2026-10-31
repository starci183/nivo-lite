import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentGraphQuery, AgentGraphQueryVariables } from "../__generated__/graphql"

/** The input of the `agentGraph` query. */
export type QueryAgentGraphRequest = WireInput<AgentGraphQueryVariables["input"]>

type QueryAgentGraphResponse = AgentGraphQuery

const query1: TypedDocumentNode<QueryAgentGraphResponse, InputVariables<QueryAgentGraphRequest>> = gql`
    query AgentGraph($input: GetAgentGraphInput!) {
        agentGraph(input: $input) {
            activeVersionId
            agentId
            cardsJson
            draftJson
            draftRev
            gapsJson
            installationId
            mode
            problemsJson
            proposalsJson
        }
    }
`

enum QueryAgentGraph {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentGraph,
    TypedDocumentNode<QueryAgentGraphResponse, InputVariables<QueryAgentGraphRequest>>
> = {
    [QueryAgentGraph.Query1]: query1,
}

type QueryAgentGraphParams = QueryParams<QueryAgentGraph, QueryAgentGraphRequest> & { request: QueryAgentGraphRequest }

/** The back end `agentGraph` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentGraph = async ({ query = QueryAgentGraph.Query1, request, signal }: QueryAgentGraphParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
