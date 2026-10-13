import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryAdminWorkspaceArgs } from "../__generated__/schema"

/** The variables of the `adminWorkspace` query. */
export type QueryAdminWorkspaceRequest = QueryAdminWorkspaceArgs["input"]

/** The response of the `adminWorkspace` query: the typed payload straight from the back end contract. */
export type QueryAdminWorkspaceResponse = Pick<Query, "adminWorkspace">

const query1: TypedDocumentNode<QueryAdminWorkspaceResponse, InputVariables<QueryAdminWorkspaceRequest>> = gql`
    query AdminWorkspace($input: AdminWorkspaceInput!) {
        adminWorkspace(input: $input) {
            workspace {
                id
                name
                ownerEmail
                status
                planCode
                paidUntil
                createdAt
            }
            credits {
                used
                limit
                costUsd
                ownLimit
            }
            members {
                userId
                role
                displayName
                status
                email
            }
            invites {
                id
                email
                role
                createdAt
                expiresAt
            }
            orders {
                id
                orderCode
                planCode
                amountVnd
                status
                createdAt
                paidAt
            }
            transfers {
                sepayId
                transferAmount
                content
                status
                receivedAt
            }
            billingEvents {
                id
                kind
                createdAt
            }
            modules {
                id
                key
                status
                operatingMode
                live
                processor
                contextVersion
                contextAppliedAt
                sync {
                    agentId
                    contextVersion
                    checkedAt
                    status
                    error
                }
            }
            connections {
                id
                provider
                name
                status
                environment
                lastEventAt
                lastError
                health
            }
            errors {
                id
                scope
                message
                createdAt
            }
            knowledgeTotal
            knowledge {
                kind
                byStatus {
                    key
                    count
                }
            }
            activity {
                messages7d
                lastCustomerMessageAt
                openDecisions
            }
        }
    }
`

enum QueryAdminWorkspace {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAdminWorkspace,
    TypedDocumentNode<QueryAdminWorkspaceResponse, InputVariables<QueryAdminWorkspaceRequest>>
> = {
    [QueryAdminWorkspace.Query1]: query1,
}

/** Apollo params for {@link queryAdminWorkspace}. */
interface QueryAdminWorkspaceParams extends QueryParams<QueryAdminWorkspace, QueryAdminWorkspaceRequest> {
    request: QueryAdminWorkspaceRequest
}

/**
 * Reads the read-only overview of one workspace (the back end `adminWorkspace` query).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server) instead of answering partial data.
 */
export const queryAdminWorkspace = async ({
    query = QueryAdminWorkspace.Query1,
    request,
    signal,
}: QueryAdminWorkspaceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
