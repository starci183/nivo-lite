import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentsArgs } from "../__generated__/schema"

/** The input of the `agents` query. */
export type QueryAgentsRequest = QueryAgentsArgs["input"]

type QueryAgentsResponse = Pick<Query, "agents">

const query1: TypedDocumentNode<QueryAgentsResponse, InputVariables<QueryAgentsRequest>> = gql`
    query Agents($input: ListAgentsInput!) {
        agents(input: $input) {
            id
            handle
            module
            name
        }
    }
`

enum QueryAgents {
    Query1 = "query1",
}

const queryMap: Record<QueryAgents, TypedDocumentNode<QueryAgentsResponse, InputVariables<QueryAgentsRequest>>> = {
    [QueryAgents.Query1]: query1,
}

type QueryAgentsParams = QueryParams<QueryAgents, QueryAgentsRequest> & { request: QueryAgentsRequest }

/** The back end `agents` query. Rejects with the back end failure (message localized by the server). */
export const queryAgents = async ({ query = QueryAgents.Query1, request, signal }: QueryAgentsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
