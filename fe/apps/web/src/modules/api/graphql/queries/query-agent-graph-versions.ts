import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentGraphVersionsQuery, AgentGraphVersionsQueryVariables } from "../__generated__/graphql"

/** The input of the `agentGraphVersions` query. */
export type QueryAgentGraphVersionsRequest = WireInput<AgentGraphVersionsQueryVariables["input"]>

type QueryAgentGraphVersionsResponse = AgentGraphVersionsQuery

const query1: TypedDocumentNode<QueryAgentGraphVersionsResponse, InputVariables<QueryAgentGraphVersionsRequest>> = gql`
    query AgentGraphVersions($input: ListAgentGraphVersionsInput!) {
        agentGraphVersions(input: $input) {
            changeKind
            id
            note
            publishedAt
            publishedBy
            version
        }
    }
`

enum QueryAgentGraphVersions {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentGraphVersions,
    TypedDocumentNode<QueryAgentGraphVersionsResponse, InputVariables<QueryAgentGraphVersionsRequest>>
> = {
    [QueryAgentGraphVersions.Query1]: query1,
}

type QueryAgentGraphVersionsParams = QueryParams<QueryAgentGraphVersions, QueryAgentGraphVersionsRequest> & {
    request: QueryAgentGraphVersionsRequest
}

/** The back end `agentGraphVersions` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentGraphVersions = async ({
    query = QueryAgentGraphVersions.Query1,
    request,
    signal,
}: QueryAgentGraphVersionsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
