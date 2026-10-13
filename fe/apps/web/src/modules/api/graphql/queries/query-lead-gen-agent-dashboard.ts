import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentDashboardArgs } from "../__generated__/schema"

/** The generated shared dashboard contract selected for Lead Gen. */
type QueryLeadGenAgentDashboardRequest = QueryAgentDashboardArgs["input"]

/** The QueryLeadGenAgentDashboardResponse of this operation, straight from the generated schema. */
export type QueryLeadGenAgentDashboardResponse = Pick<Query, "agentDashboard">

type Document = TypedDocumentNode<QueryLeadGenAgentDashboardResponse, InputVariables<QueryLeadGenAgentDashboardRequest>>

const query1: Document = gql`
    query LeadGenAgentDashboard($input: AgentDashboardInput!) {
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
                        customer
                        action
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
                        customer
                        action
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

enum QueryLeadGenAgentDashboard {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadGenAgentDashboard, Document> = { [QueryLeadGenAgentDashboard.Query1]: query1 }

/** Apollo params for the QueryLeadGenAgentDashboard operation. */
type QueryLeadGenAgentDashboardParams = QueryParams<QueryLeadGenAgentDashboard, QueryLeadGenAgentDashboardRequest> & {
    request: QueryLeadGenAgentDashboardRequest
}

/** Reads the frame regions of the Lead Gen instance through the shared dashboard resolver. */
export const queryLeadGenAgentDashboard = async ({
    query = QueryLeadGenAgentDashboard.Query1,
    request,
    signal,
}: QueryLeadGenAgentDashboardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
