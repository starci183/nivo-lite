import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ModuleInstallationsQuery } from "../__generated__/graphql"

/** The response of the `moduleInstallations` query: the typed payload straight from the back end contract. */
type QueryModuleInstallationsResponse = ModuleInstallationsQuery

const query1: TypedDocumentNode<QueryModuleInstallationsResponse> = gql`
    query ModuleInstallations {
        moduleInstallations {
            activeContextVersionId
            activeVersion
            agentAvatarPreset
            agentAvatarUrl
            agentHandle
            agentId
            agentName
            connectionNeeds {
                role
                providers
            }
            createdAt
            id
            isMulti
            lifecycle
            liveEnabled
            moduleKey
            name
            operatingMode
            settings
            setupProgress {
                confirmed
                total
            }
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
}: QueryModuleInstallationsParams = {}): Promise<ApolloClient.QueryResult<QueryModuleInstallationsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query] })
}
