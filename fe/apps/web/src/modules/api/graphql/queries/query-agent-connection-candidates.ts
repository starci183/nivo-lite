import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentConnectionCandidatesQuery, AgentConnectionCandidatesQueryVariables } from "../__generated__/graphql"

/** The input of the `agentConnectionCandidates` query. */
export type QueryAgentConnectionCandidatesRequest = WireInput<AgentConnectionCandidatesQueryVariables["input"]>

type QueryAgentConnectionCandidatesResponse = AgentConnectionCandidatesQuery

const query1: TypedDocumentNode<
    QueryAgentConnectionCandidatesResponse,
    InputVariables<QueryAgentConnectionCandidatesRequest>
> = gql`
    query AgentConnectionCandidates($input: AgentConnectionCandidatesInput!) {
        agentConnectionCandidates(input: $input) {
            access
            accountMasked
            botUsername
            id
            name
            provider
            purpose
            status
        }
    }
`

enum QueryAgentConnectionCandidates {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentConnectionCandidates,
    TypedDocumentNode<QueryAgentConnectionCandidatesResponse, InputVariables<QueryAgentConnectionCandidatesRequest>>
> = {
    [QueryAgentConnectionCandidates.Query1]: query1,
}

type QueryAgentConnectionCandidatesParams = QueryParams<
    QueryAgentConnectionCandidates,
    QueryAgentConnectionCandidatesRequest
> & {
    request: QueryAgentConnectionCandidatesRequest
}

/** The back end `agentConnectionCandidates` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentConnectionCandidates = async ({
    query = QueryAgentConnectionCandidates.Query1,
    request,
    signal,
}: QueryAgentConnectionCandidatesParams): Promise<ApolloClient.QueryResult<QueryAgentConnectionCandidatesResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
