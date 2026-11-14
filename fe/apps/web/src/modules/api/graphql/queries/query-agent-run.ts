import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentRunQuery, AgentRunQueryVariables } from "../__generated__/graphql"

/** The input of the `agentRun` query. */
export type QueryAgentRunRequest = WireInput<AgentRunQueryVariables["input"]>

type QueryAgentRunResponse = AgentRunQuery

const query1: TypedDocumentNode<QueryAgentRunResponse, InputVariables<QueryAgentRunRequest>> = gql`
    query AgentRun($input: AgentRunInput!) {
        agentRun(input: $input) {
            canCancel
            canResume
            decision {
                decisionId
                options
                stepKey
                title
                workItemId
            }
            item {
                action
                error
                evidence {
                    key
                    value
                }
                id
                reason
                status
                summary
            }
            row {
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
            truthReads {
                tool
                at
                facts {
                    factId
                    version
                }
            }
            steps {
                attempt
                calls {
                    failure
                    ok
                    tool
                }
                durationMs
                errorCode
                input {
                    key
                    value
                }
                maxAttempts
                nodeKey
                ordinal
                output {
                    key
                    value
                }
                startedAt
                status
                stepKey
                workItemId
            }
        }
    }
`

enum QueryAgentRun {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentRun, TypedDocumentNode<QueryAgentRunResponse, InputVariables<QueryAgentRunRequest>>> = {
    [QueryAgentRun.Query1]: query1,
}

type QueryAgentRunParams = QueryParams<QueryAgentRun, QueryAgentRunRequest> & {
    request: QueryAgentRunRequest
}

/** The back end `agentRun` query. One run of an agent with its steps and the work item it is about; null when the agent has no such run. Rejects with the back end failure (message localized by the server). */
export const queryAgentRun = async ({
    query = QueryAgentRun.Query1,
    request,
    signal,
}: QueryAgentRunParams): Promise<ApolloClient.QueryResult<QueryAgentRunResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
