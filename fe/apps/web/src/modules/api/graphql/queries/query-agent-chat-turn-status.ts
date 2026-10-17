import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentChatTurnStatusQuery, AgentChatTurnStatusQueryVariables } from "../__generated__/graphql"

/** Generated variables of the queued turn status query. */
type QueryAgentChatTurnStatusRequest = WireInput<AgentChatTurnStatusQueryVariables["input"]>

/** Generated selection of the queued turn status query. */
type QueryAgentChatTurnStatusResponse = AgentChatTurnStatusQuery

type Document = TypedDocumentNode<QueryAgentChatTurnStatusResponse, InputVariables<QueryAgentChatTurnStatusRequest>>

const query1: Document = gql`
    query AgentChatTurnStatus($input: AgentChatTurnStatusInput!) {
        agentChatTurnStatus(input: $input) {
            id
            jobId
            conversationId
            status
            resultMessageId
            errorCode
        }
    }
`

enum QueryAgentChatTurnStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentChatTurnStatus, Document> = { [QueryAgentChatTurnStatus.Query1]: query1 }

/** Parameters of the queued chat turn status query. */
type QueryAgentChatTurnStatusParams = QueryParams<QueryAgentChatTurnStatus, QueryAgentChatTurnStatusRequest> & {
    request: QueryAgentChatTurnStatusRequest
}

/** Reads the authoritative queued turn or human delivery outcome. */
export const queryAgentChatTurnStatus = async ({
    query = QueryAgentChatTurnStatus.Query1,
    request,
    signal,
    headers,
}: QueryAgentChatTurnStatusParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
        context: { headers },
    })
}
