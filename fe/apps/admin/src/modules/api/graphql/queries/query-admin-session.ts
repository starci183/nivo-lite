import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { adminApiTransport } from "@/modules/api-transport"
import type { AdminSessionQuery } from "../__generated__/graphql"

/** The response of the `adminSession` query: the typed payload straight from the back end contract. */
type QueryAdminSessionResponse = AdminSessionQuery

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
export const queryAdminSession = async ({
    query = QueryAdminSession.Query1,
    signal,
}: QueryAdminSessionParams = {}): Promise<ApolloClient.QueryResult<QueryAdminSessionResponse>> => {
    const apollo = createAuthApolloClient(adminApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
