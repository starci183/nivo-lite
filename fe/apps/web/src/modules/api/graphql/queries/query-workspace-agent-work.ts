import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { WorkspaceAgentWorkQuery } from "../__generated__/graphql"

type QueryWorkspaceAgentWorkResponse = WorkspaceAgentWorkQuery

const query1: TypedDocumentNode<QueryWorkspaceAgentWorkResponse> = gql`
    query WorkspaceAgentWork {
        workspaceAgentWork {
            agentsOff
            backgroundDailyCap
            heldWakes
            pendingWakes
            road
            workEnabled
        }
    }
`

enum QueryWorkspaceAgentWork {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceAgentWork, TypedDocumentNode<QueryWorkspaceAgentWorkResponse>> = {
    [QueryWorkspaceAgentWork.Query1]: query1,
}

type QueryWorkspaceAgentWorkParams = QueryParams<QueryWorkspaceAgentWork>

/** The back end `workspaceAgentWork` query. The work switch of the whole workspace with its counts. Rejects with the back end failure (message localized by the server). */
export const queryWorkspaceAgentWork = async ({
    query = QueryWorkspaceAgentWork.Query1,
    signal,
}: QueryWorkspaceAgentWorkParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
