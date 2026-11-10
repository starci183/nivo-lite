import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentWorkLogQuery, AgentWorkLogQueryVariables } from "../__generated__/graphql"

/** The input of the `agentWorkLog` query. */
export type QueryAgentWorkLogRequest = WireInput<AgentWorkLogQueryVariables["input"]>

type QueryAgentWorkLogResponse = AgentWorkLogQuery

const query1: TypedDocumentNode<QueryAgentWorkLogResponse, InputVariables<QueryAgentWorkLogRequest>> = gql`
    query AgentWorkLog($input: AgentWorkInstanceInput!) {
        agentWorkLog(input: $input) {
            action
            at
            connection {
                id
                name
                provider
            }
            detail
            error
            evidence {
                key
                value
            }
            evidenceCode
            evidenceKind
            id
            level
            reason
            resultHref
            status
            steps {
                at
                key
                state
            }
            title
        }
    }
`

enum QueryAgentWorkLog {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentWorkLog,
    TypedDocumentNode<QueryAgentWorkLogResponse, InputVariables<QueryAgentWorkLogRequest>>
> = {
    [QueryAgentWorkLog.Query1]: query1,
}

type QueryAgentWorkLogParams = QueryParams<QueryAgentWorkLog, QueryAgentWorkLogRequest> & {
    request: QueryAgentWorkLogRequest
}

/** The back end `agentWorkLog` query. The newest work of one agent with its connection, level, evidence and steps. Rejects with the back end failure (message localized by the server). */
export const queryAgentWorkLog = async ({
    query = QueryAgentWorkLog.Query1,
    request,
    signal,
}: QueryAgentWorkLogParams): Promise<ApolloClient.QueryResult<QueryAgentWorkLogResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
