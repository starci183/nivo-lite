import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { ChatMessagesQuery, ChatMessagesQueryVariables } from "../__generated__/graphql"

/** Generated variables of the ChatMessages query. */
type QueryChatMessagesRequest = WireInput<ChatMessagesQueryVariables["input"]>

type QueryChatMessagesResponse = ChatMessagesQuery

type Document = TypedDocumentNode<QueryChatMessagesResponse, InputVariables<QueryChatMessagesRequest>>

const query1: Document = gql`
    query ChatMessages($input: ChatMessagesInput!) {
        chatMessages(input: $input) {
            nodes {
                id
                roomId
                kind
                authorKind
                authorId
                authorName
                body
                createdAt
                editedAt
                pinned
                mentions {
                    memberKind
                    memberId
                    name
                }
                attachments {
                    fileKey
                    name
                    mimeType
                    sizeBytes
                    url
                }
                report {
                    runId
                    agentId
                }
                approval {
                    decisionId
                    status
                    decidedByName
                    decidedAt
                    canDecide
                }
                agentMessage
                stop {
                    stopId
                    runId
                    stepKey
                    stepTitle
                    workflowTitle
                    moduleKey
                    leadId
                    conversationId
                    kind
                    by
                    state
                    headline
                    message
                    question
                    suggestions {
                        text
                        handledBy
                    }
                    facts {
                        name
                        value
                    }
                    needs {
                        answer
                        decisions
                        verdicts
                    }
                    replies {
                        kind
                        text
                        by
                        byName
                        at
                    }
                    repeats
                    firstAt
                    stoppedAt
                    resolvedAt
                    approval {
                        workItemId
                        tool
                        account
                        ability
                        args {
                            name
                            value
                        }
                    }
                    revision
                }
                reactions {
                    emoji
                    count
                    mine
                    mineCount
                }
                replyTo {
                    messageId
                    authorName
                    body
                }
                forwardedFrom
            }
            pageInfo {
                hasNextPage
                endCursor
            }
        }
    }
`

enum QueryChatMessages {
    Query1 = "query1",
}

const queryMap: Record<QueryChatMessages, Document> = { [QueryChatMessages.Query1]: query1 }

/** Parameters of the ChatMessages query. */
type QueryChatMessagesParams = QueryParams<QueryChatMessages, QueryChatMessagesRequest> & {
    request: QueryChatMessagesRequest
}

/** One page of the messages of a room, newest first. */
export const queryChatMessages = async ({
    query = QueryChatMessages.Query1,
    request,
    signal,
    headers,
}: QueryChatMessagesParams): Promise<ApolloClient.QueryResult<QueryChatMessagesResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
}
