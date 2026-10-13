import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryChatbotThreadArgs } from "../__generated__/schema"

/** The input of the `chatbotThread` query. */
type QueryChatbotThreadRequest = QueryChatbotThreadArgs["input"]

/** The response of the `chatbotThread` query. */
type QueryChatbotThreadResponse = Pick<Query, "chatbotThread">

type Document = TypedDocumentNode<QueryChatbotThreadResponse, InputVariables<QueryChatbotThreadRequest>>

const query1: Document = gql`
    query ChatbotThread($input: ChatbotThreadInput!) {
        chatbotThread(input: $input) {
            conversation {
                id
                channel
                name
                leadId
                lastText
                lastRole
                lastAt
                messageCount
                handledBy
                waiting
                unanswered
            }
            escalation {
                workItemId
                question
                draft
                staffName
                since
            }
            externalId
            handledAt
            lead {
                id
                company
                email
                name
                need
                phone
                stage
            }
            messages {
                id
                authorKind
                authorName
                body
                createdAt
                delivery
                deliveryError
                role
            }
        }
    }
`

enum QueryChatbotThread {
    Query1 = "query1",
}

const queryMap: Record<QueryChatbotThread, Document> = {
    [QueryChatbotThread.Query1]: query1,
}

/** Apollo params for {@link queryChatbotThread}. */
type QueryChatbotThreadParams = QueryParams<QueryChatbotThread, QueryChatbotThreadRequest> & {
    request: QueryChatbotThreadRequest
}

/** Reads the back end `chatbotThread` query with the caller's workspace context. */
export const queryChatbotThread = async ({
    query = QueryChatbotThread.Query1,
    request,
    signal,
}: QueryChatbotThreadParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
