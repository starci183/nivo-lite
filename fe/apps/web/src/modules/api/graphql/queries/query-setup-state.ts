import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QuerySetupStateArgs } from "../__generated__/schema"

/** The input of the `setupState` query. */
export type QuerySetupStateRequest = QuerySetupStateArgs["input"]

type QuerySetupStateResponse = Pick<Query, "setupState">

const query1: TypedDocumentNode<QuerySetupStateResponse, InputVariables<QuerySetupStateRequest>> = gql`
    query SetupState($input: ModuleInstallationIdInput!) {
        setupState(input: $input) {
            cards {
                card {
                    createdAt
                    decidedBy
                    gateKey
                    id
                    kind
                    payload
                    result
                    setupSessionId
                    sourceMessageId
                    status
                    targetKey
                    workspaceId
                }
                current
            }
            installation {
                activeContextVersionId
                activeVersion
                agentHandle
                agentId
                agentName
                createdAt
                id
                isMulti
                liveEnabled
                moduleKey
                name
                operatingMode
                settings
                status
                workspaceId
            }
            messages {
                author
                body
                createdAt
                id
                role
                setupSessionId
            }
            revisions {
                id
                revision
                status
            }
            session {
                createdAt
                draft {
                    facts {
                        key
                        text
                    }
                    summary
                }
                gateEvidence
                id
                installationId
                revision
                status
                workspaceId
            }
            turnPending
        }
    }
`

enum QuerySetupState {
    Query1 = "query1",
}

const queryMap: Record<
    QuerySetupState,
    TypedDocumentNode<QuerySetupStateResponse, InputVariables<QuerySetupStateRequest>>
> = {
    [QuerySetupState.Query1]: query1,
}

type QuerySetupStateParams = QueryParams<QuerySetupState, QuerySetupStateRequest> & { request: QuerySetupStateRequest }

/** The back end `setupState` query. Rejects with the back end failure (message localized by the server). */
export const querySetupState = async ({ query = QuerySetupState.Query1, request, signal }: QuerySetupStateParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
