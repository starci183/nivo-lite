import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ChatTypingChannelQuery, ChatTypingChannelQueryVariables } from "../__generated__/graphql"

/** The input of the `chatTypingChannel` query. */
export type QueryChatTypingChannelRequest = WireInput<ChatTypingChannelQueryVariables["input"]>

type QueryChatTypingChannelResponse = ChatTypingChannelQuery

/** The authorized private typing channel the `chatTypingChannel` query answers with. */
export type QueryChatTypingChannelResult = QueryChatTypingChannelResponse["chatTypingChannel"]

const query1: TypedDocumentNode<QueryChatTypingChannelResponse, InputVariables<QueryChatTypingChannelRequest>> = gql`
    query ChatTypingChannel($input: ChatTypingTargetInput!) {
        chatTypingChannel(input: $input) {
            event
            private
            topic
            ttlMs
        }
    }
`

enum QueryChatTypingChannel {
    Query1 = "query1",
}

const queryMap: Record<
    QueryChatTypingChannel,
    TypedDocumentNode<QueryChatTypingChannelResponse, InputVariables<QueryChatTypingChannelRequest>>
> = {
    [QueryChatTypingChannel.Query1]: query1,
}

type QueryChatTypingChannelParams = QueryParams<QueryChatTypingChannel, QueryChatTypingChannelRequest> & {
    request: QueryChatTypingChannelRequest
}

/** The back end `chatTypingChannel` query. Rejects with the back end failure (message localized by the server). */
export const queryChatTypingChannel = async ({
    query = QueryChatTypingChannel.Query1,
    request,
    signal,
}: QueryChatTypingChannelParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
