import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { McpCallLogQuery, McpCallLogQueryVariables } from "../__generated__/graphql"

/** The response of the `mcpCallLog` query: the typed payload straight from the back end contract. */
type QueryMcpCallLogResponse = McpCallLogQuery

const query1: TypedDocumentNode<QueryMcpCallLogResponse, McpCallLogQueryVariables> = gql`
    query McpCallLog($input: McpCallLogInput) {
        mcpCallLog(input: $input) {
            id
            tool
            agentName
            outcome
            errorCode
            argsMasked
            resultSummary
            durationMs
            approvedBy
            at
        }
    }
`

enum QueryMcpCallLog {
    Query1 = "query1",
}

const queryMap: Record<QueryMcpCallLog, TypedDocumentNode<QueryMcpCallLogResponse, McpCallLogQueryVariables>> = {
    [QueryMcpCallLog.Query1]: query1,
}

/** Apollo params for {@link queryMcpCallLog}. */
type QueryMcpCallLogParams = QueryParams<QueryMcpCallLog, McpCallLogQueryVariables>

/** The latest audited gateway calls, secrets masked. Rejects with the back end failure. */
export const queryMcpCallLog = async ({
    query = QueryMcpCallLog.Query1,
    request,
    signal,
}: QueryMcpCallLogParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: request ?? { input: null },
        fetchPolicy: "no-cache",
    })
}
