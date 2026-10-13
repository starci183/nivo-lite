import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `adminSession` query: the typed payload straight from the back end contract. */
type QueryAdminSessionResponse = Pick<Query, "adminSession">

const query1: TypedDocumentNode<QueryAdminSessionResponse> = gql`
    query AdminSession {
        adminSession {
            email
        }
    }
`

enum QueryAdminSession {
    Query1 = "query1",
}

const queryMap: Record<QueryAdminSession, TypedDocumentNode<QueryAdminSessionResponse>> = {
    [QueryAdminSession.Query1]: query1,
}

/** Apollo params for {@link queryAdminSession}. */
type QueryAdminSessionParams = QueryParams<QueryAdminSession>

/**
 * Asks who the signed-in platform admin is; anyone else is refused as not found (the back end `adminSession` query).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server) instead of answering partial data.
 */
export const queryAdminSession = async ({ query = QueryAdminSession.Query1, signal }: QueryAdminSessionParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
