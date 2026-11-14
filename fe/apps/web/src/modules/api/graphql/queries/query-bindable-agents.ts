import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BindableAgentsQuery, BindableAgentsQueryVariables } from "../__generated__/graphql"

/** The variables of the `bindableAgents` query. */
export type QueryBindableAgentsRequest = WireInput<BindableAgentsQueryVariables["input"]>

type QueryBindableAgentsResponse = BindableAgentsQuery

const query1: TypedDocumentNode<QueryBindableAgentsResponse, InputVariables<QueryBindableAgentsRequest>> = gql`
    query BindableAgents($input: BindableAgentsInput!) {
        bindableAgents(input: $input) {
            agentId
            purpose
        }
    }
`

enum QueryBindableAgents {
    Query1 = "query1",
}

const queryMap: Record<
    QueryBindableAgents,
    TypedDocumentNode<QueryBindableAgentsResponse, InputVariables<QueryBindableAgentsRequest>>
> = {
    [QueryBindableAgents.Query1]: query1,
}

type QueryBindableAgentsParams = QueryParams<QueryBindableAgents, QueryBindableAgentsRequest> & {
    request: QueryBindableAgentsRequest
}

/**
 * The active agents of the workspace that may be bound to a connection of one provider, each with what it would do there (the back
 * end `bindableAgents` query, read from the installation). Rejects with the back end failure (message localized by the server).
 */
export const queryBindableAgents = async ({
    query = QueryBindableAgents.Query1,
    request,
    signal,
}: QueryBindableAgentsParams): Promise<ApolloClient.QueryResult<QueryBindableAgentsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
