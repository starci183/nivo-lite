import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { SetupStateQuery, SetupStateQueryVariables } from "../__generated__/graphql"

/** The input of the `setupState` query. */
export type QuerySetupStateRequest = WireInput<SetupStateQueryVariables["input"]>

type QuerySetupStateResponse = SetupStateQuery

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
                lifecycle
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
