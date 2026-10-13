import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentDashboardArgs } from "../__generated__/schema"

/** Generated input of the agentDashboard query. */
export type QueryAgentDashboardRequest = QueryAgentDashboardArgs["input"]

/** Generated response of the agentDashboard query. */
type QueryAgentDashboardResponse = Pick<Query, "agentDashboard">

type Document = TypedDocumentNode<QueryAgentDashboardResponse, InputVariables<QueryAgentDashboardRequest>>

const query1: Document = gql`
    query AgentDashboard($input: AgentDashboardInput!) {
        agentDashboard(input: $input) {
            agent {
                id
                mode
                name
            }
            connections {
                data {
                    access
                    id
                    name
                    provider
                    purpose
                    status
                }
                ok
            }
            done {
                data {
                    count
                    items {
                        action
                        at
                        customer
                        id
                        leadId
                        resultHref
                        title
                    }
                }
                ok
            }
            knowledge {
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
                        items {
                            count
                            id
                            lastSeenAt
                            question
                        }
                        openCount
                    }
                }
                ok
            }
            waiting {
                data {
                    items {
                        action
                        at
                        customer
                        id
                        leadId
                        resultHref
                        title
                    }
                    total
                }
                ok
            }
        }
    }
`

enum QueryAgentDashboard {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentDashboard, Document> = {
    [QueryAgentDashboard.Query1]: query1,
}

/** Apollo parameters for the agentDashboard query. */
type QueryAgentDashboardParams = QueryParams<QueryAgentDashboard, QueryAgentDashboardRequest> & {
    request: QueryAgentDashboardRequest
}

/** Runs the workspace-scoped agentDashboard query through the authenticated GraphQL client. */
export const queryAgentDashboard = async ({
    query = QueryAgentDashboard.Query1,
    request,
    signal,
    headers,
}: QueryAgentDashboardParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
