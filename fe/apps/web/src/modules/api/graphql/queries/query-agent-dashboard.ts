import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentDashboardArgs } from "../__generated__/schema"

/** The input of the `agentDashboard` query. */
export type QueryAgentDashboardRequest = QueryAgentDashboardArgs["input"]

type QueryAgentDashboardResponse = Pick<Query, "agentDashboard">

const query1: TypedDocumentNode<QueryAgentDashboardResponse, InputVariables<QueryAgentDashboardRequest>> = gql`
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

const queryMap: Record<
    QueryAgentDashboard,
    TypedDocumentNode<QueryAgentDashboardResponse, InputVariables<QueryAgentDashboardRequest>>
> = {
    [QueryAgentDashboard.Query1]: query1,
}

type QueryAgentDashboardParams = QueryParams<QueryAgentDashboard, QueryAgentDashboardRequest> & {
    request: QueryAgentDashboardRequest
}

/** The back end `agentDashboard` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentDashboard = async ({
    query = QueryAgentDashboard.Query1,
    request,
    signal,
}: QueryAgentDashboardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
