import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentChatTurnStatusArgs } from "../__generated__/schema"

/** Generated variables of the queued turn status query. */
type QueryAgentChatTurnStatusRequest = QueryAgentChatTurnStatusArgs["input"]

/** Generated selection of the queued turn status query. */
type QueryAgentChatTurnStatusResponse = Pick<Query, "agentChatTurnStatus">

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

/** Parameters of the queued chat turn status query. */
type QueryAgentChatTurnStatusParams = QueryParams<QueryAgentChatTurnStatus, QueryAgentChatTurnStatusRequest> & {
    request: QueryAgentChatTurnStatusRequest
}

/** Reads the authoritative queued turn or human delivery outcome. */
export const queryAgentChatTurnStatus = async ({ request, signal, headers }: QueryAgentChatTurnStatusParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: query1,
        variables: { input: request },
        context: { headers },
    })
}
