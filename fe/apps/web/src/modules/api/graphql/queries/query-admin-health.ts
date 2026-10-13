import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `adminHealth` query: the typed payload straight from the back end contract. */
export type QueryAdminHealthResponse = Pick<Query, "adminHealth">

const query1: TypedDocumentNode<QueryAdminHealthResponse> = gql`
    query AdminHealth {
        adminHealth {
            signups {
                day
                signups
            }
            transfers {
                status
                transferAmount
                content
                receivedAt
            }
            transferCounts {
                key
                count
            }
            billingEvents {
                id
                workspaceId
                kind
                createdAt
            }
            errors {
                id
                scope
                message
                workspaceId
                createdAt
            }
            errorScopes {
                key
                count
            }
            audits {
                id
                actorEmail
                action
                workspaceId
                createdAt
            }
            workspaceNames {
                id
                name
            }
        }
    }
`

enum QueryAdminHealth {
    Query1 = "query1",
}

const queryMap: Record<QueryAdminHealth, TypedDocumentNode<QueryAdminHealthResponse>> = {
    [QueryAdminHealth.Query1]: query1,
}

/** Apollo params for {@link queryAdminHealth}. */
type QueryAdminHealthParams = QueryParams<QueryAdminHealth>

/**
 * Reads sign-ups, billing events, application errors and the latest console activity (the back end `adminHealth` query).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server) instead of answering partial data.
 */
export const queryAdminHealth = async ({ query = QueryAdminHealth.Query1, signal }: QueryAdminHealthParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
