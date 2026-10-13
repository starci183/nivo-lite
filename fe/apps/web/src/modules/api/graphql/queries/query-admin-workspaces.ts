import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAdminWorkspacesArgs } from "../__generated__/schema"

/** The variables of the `adminWorkspaces` query. */
export type QueryAdminWorkspacesRequest = QueryAdminWorkspacesArgs["input"]

/** The response of the `adminWorkspaces` query: the typed payload straight from the back end contract. */
export type QueryAdminWorkspacesResponse = Pick<Query, "adminWorkspaces">

const query1: TypedDocumentNode<QueryAdminWorkspacesResponse, InputVariables<QueryAdminWorkspacesRequest>> = gql`
    query AdminWorkspaces($input: AdminWorkspacesInput!) {
        adminWorkspaces(input: $input) {
            total
            counts {
                all
                attention
                unpaid
                idle
            }
            items {
                id
                name
                ownerEmail
                status
                planCode
                paidUntil
                createdAt
                members
                modules {
                    key
                    status
                    live
                }
                connections {
                    provider
                    count
                    error
                    silent
                }
                connectionWarning
                lastCustomerMessageAt
                messages7d
                openDecisions
                errors24h
                attention
                unpaid
                idle7d
            }
        }
    }
`

enum QueryAdminWorkspaces {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAdminWorkspaces,
    TypedDocumentNode<QueryAdminWorkspacesResponse, InputVariables<QueryAdminWorkspacesRequest>>
> = {
    [QueryAdminWorkspaces.Query1]: query1,
}

/** Apollo params for {@link queryAdminWorkspaces}. */
interface QueryAdminWorkspacesParams extends QueryParams<QueryAdminWorkspaces, QueryAdminWorkspacesRequest> {
    request: QueryAdminWorkspacesRequest
}

/**
 * Lists every customer workspace the filter and the search keep, with the size of each filter (the back end `adminWorkspaces` query).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server) instead of answering partial data.
 */
export const queryAdminWorkspaces = async ({
    query = QueryAdminWorkspaces.Query1,
    request,
    signal,
}: QueryAdminWorkspacesParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
