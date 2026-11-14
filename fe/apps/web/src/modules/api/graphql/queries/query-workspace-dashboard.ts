import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
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
            conversations {
                current
                previous
            }
            newContacts {
                current
                previous
            }
            runsDone {
                current
                previous
            }
            runsFailed {
                current
                previous
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
    createAuthApolloClient(webApiTransport, { signal, headers }).query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
