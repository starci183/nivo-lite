import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryChatReplyStatusArgs } from "../__generated__/schema"

/** The input of the `chatReplyStatus` query. */
type QueryChatReplyStatusRequest = QueryChatReplyStatusArgs["input"]

/** The response of the `chatReplyStatus` query. */
type QueryChatReplyStatusResponse = Pick<Query, "chatReplyStatus">

type Document = TypedDocumentNode<QueryChatReplyStatusResponse, InputVariables<QueryChatReplyStatusRequest>>

const query1: Document = gql`
    query ChatReplyStatus($input: ChatReplyStatusInput!) {
        chatReplyStatus(input: $input) {
            id
            status
            messageId
            delivery
            errorCode
        }
    }
`

enum QueryChatReplyStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryChatReplyStatus, Document> = {
    [QueryChatReplyStatus.Query1]: query1,
}

/** Apollo params for {@link queryChatReplyStatus}. */
type QueryChatReplyStatusParams = QueryParams<QueryChatReplyStatus, QueryChatReplyStatusRequest> & {
    request: QueryChatReplyStatusRequest
}

/** Reads the back end `chatReplyStatus` query with the caller's workspace context. */
export const queryChatReplyStatus = async ({
    query = QueryChatReplyStatus.Query1,
    request,
    signal,
}: QueryChatReplyStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
