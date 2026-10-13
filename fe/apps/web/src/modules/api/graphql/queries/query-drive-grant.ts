import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { DriveGrantQuery } from "../__generated__/graphql"

/** The response of the `driveGrant` query: the typed payload straight from the back end contract. */
type QueryDriveGrantResponse = DriveGrantQuery

const query1: TypedDocumentNode<QueryDriveGrantResponse> = gql`
    query DriveGrant {
        driveGrant {
            state
            email
        }
    }
`

enum QueryDriveGrant {
    Query1 = "query1",
}

const queryMap: Record<QueryDriveGrant, TypedDocumentNode<QueryDriveGrantResponse>> = {
    [QueryDriveGrant.Query1]: query1,
}

/** Apollo params for {@link queryDriveGrant}. */
type QueryDriveGrantParams = QueryParams<QueryDriveGrant>

/**
 * Where the Google Drive read grant of the active workspace stands (`none`, `connected` or `lost`) and which Google account
 * gave it (the back end `driveGrant` query, owner or manager). Rejects with the back end failure.
 */
export const queryDriveGrant = async ({ query = QueryDriveGrant.Query1, signal }: QueryDriveGrantParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
