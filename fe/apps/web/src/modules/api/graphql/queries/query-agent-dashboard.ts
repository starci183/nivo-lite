import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentDashboardArgs } from "../__generated__/schema"

/** The dashboard scope accepted by the back end. */
export type QueryAgentDashboardRequest = QueryAgentDashboardArgs["input"]

/** The dashboard regions returned by the back end contract. */
type QueryAgentDashboardResponse = Pick<Query, "agentDashboard">

type Document = TypedDocumentNode<QueryAgentDashboardResponse, InputVariables<QueryAgentDashboardRequest>>

const query1: Document = gql`
    query AgentDashboard($input: AgentDashboardInput!) {
        agentDashboard(input: $input) {
            agent {
                id
                name
                mode
            }
            waiting {
                ok
                data {
                    total
                    items {
                        id
                        title
                        action
                        customer
                        at
                        leadId
                        resultHref
                    }
                }
            }
            done {
                ok
                data {
                    count
                    items {
                        id
                        title
                        action
                        customer
                        at
                        leadId
                        resultHref
                    }
                }
            }
            connections {
                ok
                data {
                    id
                    name
                    provider
                    status
                    access
                    purpose
                }
            }
            knowledge {
                ok
                data {
                    audience
                    documents {
                        public
                        internal
                    }
                    facts {
                        public
                        internal
                        restricted
                    }
                    gaps {
                        openCount
                        items {
                            id
                            question
                            count
                            lastSeenAt
                        }
                    }
                }
            }
        }
    }
`

enum QueryAgentDashboard {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentDashboard, Document> = { [QueryAgentDashboard.Query1]: query1 }

type QueryAgentDashboardParams = QueryParams<QueryAgentDashboard, QueryAgentDashboardRequest> & {
    request: QueryAgentDashboardRequest
}

/** Reads the agent dashboard without moving data loading into the server page. */
export const queryAgentDashboard = async ({
    query = QueryAgentDashboard.Query1,
    request,
    signal,
}: QueryAgentDashboardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
