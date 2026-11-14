import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentRunAiCallsQuery, AgentRunAiCallsQueryVariables } from "../__generated__/graphql"

/** Generated input of the agentRun query read for its AI calls. */
export type QueryAgentRunAiCallsRequest = WireInput<AgentRunAiCallsQueryVariables["input"]>

/** Generated response of the agentRun query read for its AI calls. */
type QueryAgentRunAiCallsResponse = AgentRunAiCallsQuery

type Document = TypedDocumentNode<QueryAgentRunAiCallsResponse, InputVariables<QueryAgentRunAiCallsRequest>>

/** Its own operation, apart from the run's page read, so a back end without `aiCalls` fails this read only and the page stays. */
const query1: Document = gql`
    query AgentRunAiCalls($input: AgentRunInput!) {
        agentRun(input: $input) {
            aiCalls {
                purpose
                label
                calls
                maxTry
                promptTokens
                cachedTokens
                completionTokens
                reasoningTokens
                durationMs
                slowestMs
                costUsd
                upstreams
                models
                finishReasons
            }
        }
    }
`

enum QueryAgentRunAiCallsDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentRunAiCallsDocument, Document> = {
    [QueryAgentRunAiCallsDocument.Query1]: query1,
}

type QueryAgentRunAiCallsParams = QueryParams<QueryAgentRunAiCallsDocument, QueryAgentRunAiCallsRequest> & {
    request: QueryAgentRunAiCallsRequest
}

/** The AI calls of one run, one row per call kind in the order of its first call; null when the agent has no such run. Rejects with the back end failure. */
export const queryAgentRunAiCalls = async ({
    query = QueryAgentRunAiCallsDocument.Query1,
    request,
    signal,
}: QueryAgentRunAiCallsParams): Promise<ApolloClient.QueryResult<QueryAgentRunAiCallsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
