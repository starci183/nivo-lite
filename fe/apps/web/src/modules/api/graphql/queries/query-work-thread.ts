import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { WorkThreadQuery, WorkThreadQueryVariables } from "../__generated__/graphql"

/** The input of the `workThread` query. */
export type QueryWorkThreadRequest = WireInput<WorkThreadQueryVariables["input"]>

type QueryWorkThreadResponse = WorkThreadQuery

const query1: TypedDocumentNode<QueryWorkThreadResponse, InputVariables<QueryWorkThreadRequest>> = gql`
    query WorkThread($input: WorkThreadIdInput!) {
        workThread(input: $input) {
            thread {
                id
                title
                leadId
                orderId
                status
                createdBy
                createdAt
                updatedAt
            }
            messages {
                id
                threadId
                authorKind
                authorId
                authorName
                authorRole
                body
                quoted
                mentions {
                    kind
                    id
                    name
                }
                approval {
                    requestId
                    action
                    amount
                    unit
                    rule
                    policy
                    expiresAt
                    outcome
                    decidedBy
                    decidedByName
                    decidedAt
                    approvers {
                        memberId
                        name
                        role
                        roomId
                        status
                    }
                    excluded {
                        memberId
                        name
                        reason
                    }
                    owner {
                        kind
                        id
                        name
                    }
                }
                createdAt
            }
        }
    }
`

enum QueryWorkThread {
    Query1 = "query1",
}

const queryMap: Record<
    QueryWorkThread,
    TypedDocumentNode<QueryWorkThreadResponse, InputVariables<QueryWorkThreadRequest>>
> = {
    [QueryWorkThread.Query1]: query1,
}

type QueryWorkThreadParams = QueryParams<QueryWorkThread, QueryWorkThreadRequest> & { request: QueryWorkThreadRequest }

/** The back end `workThread` query: one thread with its newest messages. Rejects with the back end failure (message localized by the server). */
export const queryWorkThread = async ({ query = QueryWorkThread.Query1, request, signal }: QueryWorkThreadParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
