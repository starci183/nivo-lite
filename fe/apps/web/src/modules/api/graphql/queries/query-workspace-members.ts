import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WorkspaceMembersQuery } from "../__generated__/graphql"

/** The response of the `workspaceMembers` query: the typed payload straight from the back end contract. */
type QueryWorkspaceMembersResponse = WorkspaceMembersQuery

type Document = TypedDocumentNode<QueryWorkspaceMembersResponse, Record<string, never>>

const query1: Document = gql`
    query WorkspaceMembers {
        workspaceMembers {
            avatarUrl
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
}: QueryWorkspaceMembersParams = {}): Promise<ApolloClient.QueryResult<QueryWorkspaceMembersResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query] })
}
