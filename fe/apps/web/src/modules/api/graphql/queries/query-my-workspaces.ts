import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `myWorkspaces` query: the typed payload straight from the back end contract. */
type QueryMyWorkspacesResponse = Pick<Query, "myWorkspaces">

const query1: TypedDocumentNode<QueryMyWorkspacesResponse> = gql`
    query MyWorkspaces {
        myWorkspaces {
            workspace {
                id
                name
                status
                ownerId
                createdAt
                businessType
            }
            member {
                userId
                workspaceId
                role
                staffId
                displayName
                status
            }
        }
    }
`

enum QueryMyWorkspaces {
    Query1 = "query1",
}

const queryMap: Record<QueryMyWorkspaces, TypedDocumentNode<QueryMyWorkspacesResponse>> = {
    [QueryMyWorkspaces.Query1]: query1,
}

/** Apollo params for {@link queryMyWorkspaces}. */
type QueryMyWorkspacesParams = QueryParams<QueryMyWorkspaces>

/**
 * Lists every workspace the signed-in person belongs to with their membership in each (the back end `myWorkspaces` query).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server) instead of answering partial data.
 */
export const queryMyWorkspaces = async ({ query = QueryMyWorkspaces.Query1, signal }: QueryMyWorkspacesParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
