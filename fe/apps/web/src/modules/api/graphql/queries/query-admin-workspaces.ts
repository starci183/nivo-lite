import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { AdminWorkspacesQuery, AdminWorkspacesQueryVariables } from "../__generated__/graphql"

/** The variables of the `adminWorkspaces` query. */
export type QueryAdminWorkspacesRequest = WireInput<AdminWorkspacesQueryVariables["input"]>

const query1: TypedDocumentNode<AdminWorkspacesQuery, InputVariables<QueryAdminWorkspacesRequest>> = gql`
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
    TypedDocumentNode<AdminWorkspacesQuery, InputVariables<QueryAdminWorkspacesRequest>>
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
