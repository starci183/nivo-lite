import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentDashboardArgs } from "../__generated__/schema"

/** The input of the `agentDashboard` query. */
type QueryChatbotAgentDashboardRequest = QueryAgentDashboardArgs["input"]

/** The response of the `agentDashboard` query. */
type QueryChatbotAgentDashboardResponse = Pick<Query, "agentDashboard">

type Document = TypedDocumentNode<QueryChatbotAgentDashboardResponse, InputVariables<QueryChatbotAgentDashboardRequest>>

const query1: Document = gql`
    query ChatbotAgentDashboard($input: AgentDashboardInput!) {
        agentDashboard(input: $input) {
            agent {
                id
                mode
                name
            }
            connections {
                ok
                data {
                    id
                    access
                    name
                    provider
                    purpose
                    status
                }
            }
            done {
                ok
                data {
                    count
                    items {
                        id
                        action
                        at
                        customer
                        leadId
                        resultHref
                        title
                    }
                }
            }
            knowledge {
                ok
                data {
                    audience
                    documents {
                        internal
                        public
                    }
                    facts {
                        internal
                        public
                        restricted
                    }
                    gaps {
                        openCount
                        items {
                            id
                            count
                            lastSeenAt
                            question
                        }
                    }
                }
            }
            waiting {
                ok
                data {
                    total
                    items {
                        id
                        action
                        at
                        customer
                        leadId
                        resultHref
                        title
                    }
                }
            }
        }
    }
`

enum QueryChatbotAgentDashboard {
    Query1 = "query1",
}

const queryMap: Record<QueryChatbotAgentDashboard, Document> = {
    [QueryChatbotAgentDashboard.Query1]: query1,
}

/** Apollo params for {@link queryChatbotAgentDashboard}. */
type QueryChatbotAgentDashboardParams = QueryParams<QueryChatbotAgentDashboard, QueryChatbotAgentDashboardRequest> & {
    request: QueryChatbotAgentDashboardRequest
}

/** Reads the back end `agentDashboard` query with the caller's workspace context. */
export const queryChatbotAgentDashboard = async ({
    query = QueryChatbotAgentDashboard.Query1,
    request,
    signal,
}: QueryChatbotAgentDashboardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
