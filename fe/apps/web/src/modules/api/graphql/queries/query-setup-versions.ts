import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
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
}: QuerySetupVersionsParams): Promise<ApolloClient.QueryResult<QuerySetupVersionsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request } })
}
