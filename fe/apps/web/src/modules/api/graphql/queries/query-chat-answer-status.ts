import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ChatAnswerStatusQuery, ChatAnswerStatusQueryVariables } from "../__generated__/graphql"

/** The input of the `chatAnswerStatus` query. */
type QueryChatAnswerStatusRequest = WireInput<ChatAnswerStatusQueryVariables["input"]>

/** The response of the `chatAnswerStatus` query. */
type QueryChatAnswerStatusResponse = ChatAnswerStatusQuery

type Document = TypedDocumentNode<QueryChatAnswerStatusResponse, InputVariables<QueryChatAnswerStatusRequest>>

const query1: Document = gql`
    query ChatAnswerStatus($input: ChatAnswerStatusInput!) {
        chatAnswerStatus(input: $input) {
            id
            status
            messageId
            delivery
            errorCode
        }
    }
`

enum QueryChatAnswerStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryChatAnswerStatus, Document> = {
    [QueryChatAnswerStatus.Query1]: query1,
}

/** Apollo params for {@link queryChatAnswerStatus}. */
type QueryChatAnswerStatusParams = QueryParams<QueryChatAnswerStatus, QueryChatAnswerStatusRequest> & {
    request: QueryChatAnswerStatusRequest
}

/** Reads the back end `chatAnswerStatus` query with the caller's workspace context. */
export const queryChatAnswerStatus = async ({
    query = QueryChatAnswerStatus.Query1,
    request,
    signal,
}: QueryChatAnswerStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
