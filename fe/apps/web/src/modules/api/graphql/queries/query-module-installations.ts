import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryModuleInstallationsResponse = Pick<Query, "moduleInstallations">

const query1: TypedDocumentNode<QueryModuleInstallationsResponse, Record<string, never>> = gql`
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

const queryMap: Record<
    QueryModuleInstallations,
    TypedDocumentNode<QueryModuleInstallationsResponse, Record<string, never>>
> = {
    [QueryModuleInstallations.Query1]: query1,
}

type QueryModuleInstallationsParams = QueryParams<QueryModuleInstallations>

/** The back end `moduleInstallations` query. Rejects with the back end failure (message localized by the server). */
export const queryModuleInstallations = async ({
    query = QueryModuleInstallations.Query1,
    signal,
}: QueryModuleInstallationsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
