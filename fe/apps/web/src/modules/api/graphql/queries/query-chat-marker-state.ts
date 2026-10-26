import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ChatMarkerStateQuery, ChatMarkerStateQueryVariables } from "../__generated__/graphql"

/** The input of the `chatMarkerState` query. */
export type QueryChatMarkerStateRequest = WireInput<ChatMarkerStateQueryVariables["input"]>

type QueryChatMarkerStateResponse = ChatMarkerStateQuery

const query1: TypedDocumentNode<QueryChatMarkerStateResponse, InputVariables<QueryChatMarkerStateRequest>> = gql`
    query ChatMarkerState($input: ChatTargetInput!) {
        chatMarkerState(input: $input) {
            muted
            lastOwnMessage {
                id
                status
                seenByCount
                seenBy {
                    avatarSeed
                    avatarUrl
                    id
                    name
                }
            }
        }
    }
`

enum QueryChatMarkerState {
    Query1 = "query1",
}

const queryMap: Record<
    QueryChatMarkerState,
    TypedDocumentNode<QueryChatMarkerStateResponse, InputVariables<QueryChatMarkerStateRequest>>
> = {
    [QueryChatMarkerState.Query1]: query1,
}

type QueryChatMarkerStateParams = QueryParams<QueryChatMarkerState, QueryChatMarkerStateRequest> & {
    request: QueryChatMarkerStateRequest
}

/** The back end `chatMarkerState` query. Rejects with the back end failure (message localized by the server). */
export const queryChatMarkerState = async ({
    query = QueryChatMarkerState.Query1,
    request,
    signal,
}: QueryChatMarkerStateParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
