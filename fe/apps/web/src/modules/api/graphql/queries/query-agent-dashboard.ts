import { gql, type TypedDocumentNode } from "@apollo/client"
import type { Query, QueryAgentDashboardArgs } from "../__generated__/schema"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"

type QueryAgentDashboardParams = QueryParams<QueryAgentDashboard, QueryAgentDashboardRequest> & {
    request: QueryAgentDashboardRequest
}

const query1: TypedDocumentNode<QueryAgentDashboardResponse, InputVariables<QueryAgentDashboardRequest>> = gql`
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
                        action
                        at
                        customer
                        leadId
                        resultHref
                        title
                    }
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

const queryMap: Record<QueryAgentDashboard, typeof query1> = { [QueryAgentDashboard.Query1]: query1 }

/** The generated input and response of the dashboard operation. */
type QueryAgentDashboardRequest = QueryAgentDashboardArgs["input"]
type QueryAgentDashboardResponse = Pick<Query, "agentDashboard">

/** Reads the common dashboard regions in the selected workspace. */
export const queryAgentDashboard = async ({
    query = QueryAgentDashboard.Query1,
    request,
    signal,
}: QueryAgentDashboardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
