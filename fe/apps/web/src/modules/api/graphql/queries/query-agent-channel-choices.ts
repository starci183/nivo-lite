import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgentChannelChoicesQuery, AgentChannelChoicesQueryVariables } from "../__generated__/graphql"

/** The variables of the `agentChannelChoices` query. */
export type QueryAgentChannelChoicesRequest = WireInput<AgentChannelChoicesQueryVariables["input"]>

type QueryAgentChannelChoicesResponse = AgentChannelChoicesQuery

const query1: TypedDocumentNode<
    QueryAgentChannelChoicesResponse,
    InputVariables<QueryAgentChannelChoicesRequest>
> = gql`
    query AgentChannelChoices($input: AgentChannelChoicesInput!) {
        agentChannelChoices(input: $input) {
            botUsername
            connectionId
            name
            ownerAgentId
            ownerAgentName
            provider
            purpose
            status
        }
    }
`

enum QueryAgentChannelChoices {
    Query1 = "query1",
}

const queryMap: Record<
    QueryAgentChannelChoices,
    TypedDocumentNode<QueryAgentChannelChoicesResponse, InputVariables<QueryAgentChannelChoicesRequest>>
> = {
    [QueryAgentChannelChoices.Query1]: query1,
}

type QueryAgentChannelChoicesParams = QueryParams<QueryAgentChannelChoices, QueryAgentChannelChoicesRequest> & {
    request: QueryAgentChannelChoicesRequest
}

/**
 * The channels a new agent of a role could answer, each with the agent of the role that answers it already (the back end
 * `agentChannelChoices` query). Rejects with the back end failure (message localized by the server).
 */
export const queryAgentChannelChoices = async ({
    query = QueryAgentChannelChoices.Query1,
    request,
    signal,
}: QueryAgentChannelChoicesParams): Promise<ApolloClient.QueryResult<QueryAgentChannelChoicesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
