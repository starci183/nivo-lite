import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentGraphQuery, AgentGraphQueryVariables } from "../__generated__/graphql"

/** The input of the `getAgentGraph` query. */
export type QueryAgentGraphRequest = WireInput<AgentGraphQueryVariables["input"]>

type QueryAgentGraphResponse = AgentGraphQuery

const query1: TypedDocumentNode<QueryAgentGraphResponse, InputVariables<QueryAgentGraphRequest>> = gql`
    query AgentGraph($input: GetAgentGraphInput!) {
        getAgentGraph(input: $input) {
            activeVersionId
            agentId
            cardsJson
            draftJson
            draftRev
            factsJson
            gapsJson
            installationId
            isDraftChanged
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

/** The back end `getAgentGraph` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentGraph = async ({
    query = QueryAgentGraph.Query1,
    request,
    signal,
}: QueryAgentGraphParams): Promise<ApolloClient.QueryResult<QueryAgentGraphResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
