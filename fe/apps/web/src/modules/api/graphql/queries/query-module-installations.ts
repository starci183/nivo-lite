import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `moduleInstallations` query: the typed payload straight from the back end contract. */
type QueryModuleInstallationsResponse = Pick<Query, "moduleInstallations">

const query1: TypedDocumentNode<QueryModuleInstallationsResponse> = gql`
    query ModuleInstallations {
        moduleInstallations {
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
    }
`

enum QueryModuleInstallations {
    Query1 = "query1",
}

const queryMap: Record<QueryModuleInstallations, TypedDocumentNode<QueryModuleInstallationsResponse>> = {
    [QueryModuleInstallations.Query1]: query1,
}

/** Apollo params for {@link queryModuleInstallations}. */
type QueryModuleInstallationsParams = QueryParams<QueryModuleInstallations>

/**
 * Lists the installed agents (instances) of the workspace (the back end `moduleInstallations` query). Rejects with the
 * back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryModuleInstallations = async ({
    query = QueryModuleInstallations.Query1,
    signal,
}: QueryModuleInstallationsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
