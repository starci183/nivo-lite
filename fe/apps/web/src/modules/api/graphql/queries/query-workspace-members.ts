import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `workspaceMembers` query: the typed payload straight from the back end contract. */
type QueryWorkspaceMembersResponse = Pick<Query, "workspaceMembers">

type Document = TypedDocumentNode<QueryWorkspaceMembersResponse, Record<string, never>>

const query1: Document = gql`
    query WorkspaceMembers {
        workspaceMembers {
            displayName
            email
            lastSignInAt
            role
            staffId
            status
            userId
            workspaceId
        }
    }
`

enum QueryWorkspaceMembers {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceMembers, Document> = {
    [QueryWorkspaceMembers.Query1]: query1,
}

/** Apollo params for {@link queryWorkspaceMembers}. */
type QueryWorkspaceMembersParams = QueryParams<QueryWorkspaceMembers>

/** Every member of the active workspace (the back end `workspaceMembers` query). Rejects with the back end failure instead of answering partial data. */
export const queryWorkspaceMembers = async ({
    query = QueryWorkspaceMembers.Query1,
    signal,
}: QueryWorkspaceMembersParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
