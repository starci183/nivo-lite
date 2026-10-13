import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { WorkspaceInvitesQuery } from "../__generated__/graphql"

/** The response of the `workspaceInvites` query: the typed payload straight from the back end contract. */
type QueryWorkspaceInvitesResponse = WorkspaceInvitesQuery

type Document = TypedDocumentNode<QueryWorkspaceInvitesResponse, Record<string, never>>

const query1: Document = gql`
    query WorkspaceInvites {
        workspaceInvites {
            createdAt
            email
            expiresAt
            id
            role
            staffId
        }
    }
`

enum QueryWorkspaceInvites {
    Query1 = "query1",
}

const queryMap: Record<QueryWorkspaceInvites, Document> = {
    [QueryWorkspaceInvites.Query1]: query1,
}

/** Apollo params for {@link queryWorkspaceInvites}. */
type QueryWorkspaceInvitesParams = QueryParams<QueryWorkspaceInvites>

/** The open invitations of the active workspace (the back end `workspaceInvites` query). Rejects with the back end failure instead of answering partial data. */
export const queryWorkspaceInvites = async ({
    query = QueryWorkspaceInvites.Query1,
    signal,
}: QueryWorkspaceInvitesParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
