import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams, WireInput } from "../types"
import type { SetupVersionsQuery, SetupVersionsQueryVariables } from "../__generated__/graphql"

/** The input of the `setupVersions` query. */
export type QuerySetupVersionsRequest = WireInput<SetupVersionsQueryVariables["input"]>

type QuerySetupVersionsResponse = SetupVersionsQuery

const query1: TypedDocumentNode<QuerySetupVersionsResponse, InputVariables<QuerySetupVersionsRequest>> = gql`
    query SetupVersions($input: ModuleInstallationIdInput!) {
        setupVersions(input: $input) {
            activeVersionId
            versions {
                appliedAt
                appliedBy
                id
                installationId
                snapshot
                version
            }
        }
    }
`

enum QuerySetupVersions {
    Query1 = "query1",
}

const queryMap: Record<
    QuerySetupVersions,
    TypedDocumentNode<QuerySetupVersionsResponse, InputVariables<QuerySetupVersionsRequest>>
> = {
    [QuerySetupVersions.Query1]: query1,
}

type QuerySetupVersionsParams = QueryParams<QuerySetupVersions, QuerySetupVersionsRequest> & {
    request: QuerySetupVersionsRequest
}

/** The back end `setupVersions` query. Rejects with the back end failure (message localized by the server). */
export const querySetupVersions = async ({
    query = QuerySetupVersions.Query1,
    request,
    signal,
}: QuerySetupVersionsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
