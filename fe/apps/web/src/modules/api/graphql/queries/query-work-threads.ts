import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { WorkThreadsQuery, WorkThreadsQueryVariables } from "../__generated__/graphql"

/** The input of the `workThreads` query. */
type QueryWorkThreadsRequest = WireInput<WorkThreadsQueryVariables["input"]>

type QueryWorkThreadsResponse = WorkThreadsQuery

const query1: TypedDocumentNode<QueryWorkThreadsResponse, InputVariables<QueryWorkThreadsRequest>> = gql`
    query WorkThreads($input: ListWorkThreadsInput!) {
        workThreads(input: $input) {
            id
            title
            leadId
            orderId
            status
            createdAt
            updatedAt
            lastBody
            lastAt
            messageCount
            waitingApproval
        }
    }
`

enum QueryWorkThreads {
    Query1 = "query1",
}

const queryMap: Record<
    QueryWorkThreads,
    TypedDocumentNode<QueryWorkThreadsResponse, InputVariables<QueryWorkThreadsRequest>>
> = {
    [QueryWorkThreads.Query1]: query1,
}

type QueryWorkThreadsParams = QueryParams<QueryWorkThreads, QueryWorkThreadsRequest> & {
    request: QueryWorkThreadsRequest
}

/** The back end `workThreads` query: the newest threads of the workspace with their newest line. Rejects with the back end failure (message localized by the server). */
export const queryWorkThreads = async ({
    query = QueryWorkThreads.Query1,
    request,
    signal,
}: QueryWorkThreadsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
