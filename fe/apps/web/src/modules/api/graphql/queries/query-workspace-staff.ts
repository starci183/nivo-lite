import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { WorkspaceStaffQuery } from "../__generated__/graphql"

/** The response of the `workspaceStaff` query: the typed payload straight from the back end contract. */
type QueryWorkspaceStaffResponse = WorkspaceStaffQuery

type Document = TypedDocumentNode<QueryWorkspaceStaffResponse, Record<string, never>>

const query1: Document = gql`
    query WorkspaceStaff {
        workspaceStaff {
            id
            name
            role
        }
    }
`

enum QueryWorkspaceStaff {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceStaff, Document> = {
    [QueryWorkspaceStaff.Query1]: query1,
}

/** Apollo params for {@link queryWorkspaceStaff}. */
type QueryWorkspaceStaffParams = QueryParams<QueryWorkspaceStaff>

/** The active staff rows of the active workspace (the back end `workspaceStaff` query). Rejects with the back end failure instead of answering partial data. */
export const queryWorkspaceStaff = async ({
    query = QueryWorkspaceStaff.Query1,
    signal,
}: QueryWorkspaceStaffParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
