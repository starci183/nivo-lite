import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentRunsQuery, AgentRunsQueryVariables } from "../__generated__/graphql"

/** The input of the `agentRuns` query. */
export type QueryAgentRunsRequest = WireInput<AgentRunsQueryVariables["input"]>

type QueryAgentRunsResponse = AgentRunsQuery

const query1: TypedDocumentNode<QueryAgentRunsResponse, InputVariables<QueryAgentRunsRequest>> = gql`
    query AgentRuns($input: AgentWorkInstanceInput!) {
        agentRuns(input: $input) {
            activeCount
            concurrencyLimit
            queuedCount
            runningCount
            runs {
                cancelledAt
                creditsUsed
                durationMs
                endedAt
                errorCode
                id
                queuePosition
                source
                startedAt
                status
                stepNumber
                stepTotal
                title
                versionNumber
                workItemId
                workflowKey
            }
            workflows {
                count
                key
                versionNumber
            }
        }
    }
`

enum QueryAgentRuns {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentRuns, TypedDocumentNode<QueryAgentRunsResponse, InputVariables<QueryAgentRunsRequest>>> = {
    [QueryAgentRuns.Query1]: query1,
}

type QueryAgentRunsParams = QueryParams<QueryAgentRuns, QueryAgentRunsRequest> & {
    request: QueryAgentRunsRequest
}

/** The back end `agentRuns` query. The newest runs of one agent, the workflows they ran and what is running and queued. Rejects with the back end failure (message localized by the server). */
export const queryAgentRuns = async ({
    query = QueryAgentRuns.Query1,
    request,
    signal,
}: QueryAgentRunsParams): Promise<ApolloClient.QueryResult<QueryAgentRunsResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
