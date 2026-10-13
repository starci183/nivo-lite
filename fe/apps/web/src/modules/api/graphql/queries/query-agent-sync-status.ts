import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AgentSyncStatusQuery, AgentSyncStatusQueryVariables } from "../__generated__/graphql"

/** The input of the `agentSyncStatus` query. */
export type QueryAgentSyncStatusRequest = WireInput<AgentSyncStatusQueryVariables["input"]>

type QueryAgentSyncStatusResponse = AgentSyncStatusQuery

const query1: TypedDocumentNode<QueryAgentSyncStatusResponse, InputVariables<QueryAgentSyncStatusRequest>> = gql`
    query AgentSyncStatus($input: ModuleInstallationIdInput!) {
        agentSyncStatus(input: $input) {
            activeVersion
            checkedAt
            error
            state
            syncedVersion
        }
    }
`

enum QueryAgentSyncStatus {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentSyncStatus,
    TypedDocumentNode<QueryAgentSyncStatusResponse, InputVariables<QueryAgentSyncStatusRequest>>
> = {
    [QueryAgentSyncStatus.Query1]: query1,
}

type QueryAgentSyncStatusParams = QueryParams<QueryAgentSyncStatus, QueryAgentSyncStatusRequest> & {
    request: QueryAgentSyncStatusRequest
}

/** The back end `agentSyncStatus` query. Rejects with the back end failure (message localized by the server). */
export const queryAgentSyncStatus = async ({
    query = QueryAgentSyncStatus.Query1,
    request,
    signal,
}: QueryAgentSyncStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
