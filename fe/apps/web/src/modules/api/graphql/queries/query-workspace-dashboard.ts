import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { WorkspaceDashboardQuery, WorkspaceDashboardQueryVariables } from "../__generated__/graphql"

/** Generated variables of the owner dashboard. */
type QueryWorkspaceDashboardRequest = WireInput<WorkspaceDashboardQueryVariables["input"]>

/** Generated selection returned by the owner dashboard. */
type QueryWorkspaceDashboardResponse = WorkspaceDashboardQuery

type Document = TypedDocumentNode<QueryWorkspaceDashboardResponse, InputVariables<QueryWorkspaceDashboardRequest>>

const query1: Document = gql`
    query WorkspaceDashboard($input: WorkspaceDashboardInput!) {
        workspaceDashboard(input: $input) {
            period
            from
            to
            revenue {
                current
                previous
            }
            orders {
                current
                previous
            }
            newCustomers {
                current
                previous
            }
            closeRate {
                current
                previous
            }
            agentAutoRate {
                current
                previous
            }
            days {
                day
                revenueVnd
                orders
            }
            funnel {
                visitors
                consulted
                ordered
                paid
            }
            channels {
                channel
                leads
                revenueVnd
            }
            approvals {
                total
                items {
                    id
                    agentName
                    action
                    summary
                    customer
                    createdAt
                    href
                }
            }
            savings {
                minutesSaved
                lines {
                    action
                    count
                    minutesEach
                }
                defaultMinutes
                messagesAnswered
                ordersCreated
                paymentsMatched
                creditsUsed
                creditsLimit
            }
            agents {
                agentId
                name
                handle
                module
                tasksDone
                autoRate
                waiting
                errors
                medianResponseSeconds
                minutesSaved
                credits
            }
        }
    }
`

enum QueryWorkspaceDashboard {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceDashboard, Document> = {
    [QueryWorkspaceDashboard.Query1]: query1,
}

/** Apollo parameters for the owner dashboard. */
type QueryWorkspaceDashboardParams = QueryParams<QueryWorkspaceDashboard, QueryWorkspaceDashboardRequest>

/** Reads the whole owner dashboard of the workspace selected by the Apollo context link, for one period. */
export const queryWorkspaceDashboard = ({
    query = QueryWorkspaceDashboard.Query1,
    request = { period: "last_7_days" },
    signal,
    headers,
}: QueryWorkspaceDashboardParams = {}): Promise<ApolloClient.QueryResult<QueryWorkspaceDashboardResponse>> =>
    createAuthApolloClient({ signal, headers }).query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
