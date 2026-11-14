import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { WorkspaceDeclinedInvitesQuery } from "../__generated__/graphql"

/** The response of the `workspaceDeclinedInvites` query: the typed payload straight from the back end contract. */
type QueryWorkspaceDeclinedInvitesResponse = WorkspaceDeclinedInvitesQuery

const query1: TypedDocumentNode<QueryWorkspaceDeclinedInvitesResponse> = gql`
    query WorkspaceDeclinedInvites {
        workspaceDeclinedInvites {
            declinedAt
            email
            id
            role
        }
    }
`

/** Apollo params for {@link queryWorkspaceDeclinedInvites}. */
type QueryWorkspaceDeclinedInvitesParams = Omit<QueryParams<never>, "query" | "request">

/** The invitations of the active workspace declined in the last 30 days (the back end `workspaceDeclinedInvites` query). */
export const queryWorkspaceDeclinedInvites = (
    params: QueryWorkspaceDeclinedInvitesParams = {},
): Promise<ApolloClient.QueryResult<QueryWorkspaceDeclinedInvitesResponse>> =>
    createAuthApolloClient(webApiTransport, { signal: params.signal }).query({ query: query1 })
