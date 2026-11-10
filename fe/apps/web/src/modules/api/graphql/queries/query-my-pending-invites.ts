import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { MyPendingInvitesQuery } from "../__generated__/graphql"

/** The response of the `myPendingInvites` query: the typed payload straight from the back end contract. */
type QueryMyPendingInvitesResponse = MyPendingInvitesQuery

type Document = TypedDocumentNode<QueryMyPendingInvitesResponse, Record<string, never>>

const query1: Document = gql`
    query MyPendingInvites {
        myPendingInvites {
            expiresAt
            id
            invitedByName
            role
            workspaceId
            workspaceName
        }
    }
`

enum QueryMyPendingInvites {
    Query1 = "query1",
}

const queryMap: Record<QueryMyPendingInvites, Document> = {
    [QueryMyPendingInvites.Query1]: query1,
}

/** Apollo params for {@link queryMyPendingInvites}. */
type QueryMyPendingInvitesParams = QueryParams<QueryMyPendingInvites>

/** The pending invitations to the signed-in person's email (the back end `myPendingInvites` query). Rejects with the back end failure instead of answering partial data. */
export const queryMyPendingInvites = async ({
    query = QueryMyPendingInvites.Query1,
    signal,
}: QueryMyPendingInvitesParams = {}): Promise<ApolloClient.QueryResult<QueryMyPendingInvitesResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
