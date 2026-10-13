import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAgentGenerationStatusArgs } from "../__generated__/schema"

/** Generated variables of the queued text status query. */
type QueryAgentGenerationStatusRequest = QueryAgentGenerationStatusArgs["input"]

/** Generated selection of the queued text status query. */
type QueryAgentGenerationStatusResponse = Pick<Query, "agentGenerationStatus">

type Document = TypedDocumentNode<QueryAgentGenerationStatusResponse, InputVariables<QueryAgentGenerationStatusRequest>>

const query1: Document = gql`
    query AgentGenerationStatus($input: AgentGenerationIdInput!) {
        agentGenerationStatus(input: $input) {
            generationId
            status
            output
        }
    }
`

enum QueryAgentGenerationStatus {
    Query1 = "query1",
}

/** Parameters of the queued text status query. */
type QueryAgentGenerationStatusParams = QueryParams<QueryAgentGenerationStatus, QueryAgentGenerationStatusRequest> & {
    request: QueryAgentGenerationStatusRequest
}

/** Reads where a queued text of the active workspace stands, with its output once done. */
export const queryAgentGenerationStatus = async ({ request, signal }: QueryAgentGenerationStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: query1,
        variables: { input: request },
        fetchPolicy: "no-cache",
    })
}
