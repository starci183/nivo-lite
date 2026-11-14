import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { ProviderTriggerStatesQuery, ProviderTriggerStatesQueryVariables } from "../__generated__/graphql"

/** Generated input of the providerTriggerStates query. */
type QueryProviderTriggerStatesRequest = WireInput<ProviderTriggerStatesQueryVariables["input"]>

/** Generated response of the providerTriggerStates query. */
type QueryProviderTriggerStatesResponse = ProviderTriggerStatesQuery

type Document = TypedDocumentNode<QueryProviderTriggerStatesResponse, InputVariables<QueryProviderTriggerStatesRequest>>

const query1: Document = gql`
    query ProviderTriggerStates($input: GetProviderTriggerStatesInput!) {
        providerTriggerStates(input: $input) {
            connectionId
            name
            kind
            summary {
                vi
                en
            }
            enabled
            enabledAt
            lastFiredAt
            firedCount
            decided
            deciderAgentId
            deciderAgentName
            coreDecides
            canCatchUp
            deciderChoices {
                agentId
                name
            }
        }
    }
`

enum QueryProviderTriggerStatesDocument {
    Query1 = "query1",
}

const queryMap: Record<QueryProviderTriggerStatesDocument, Document> = {
    [QueryProviderTriggerStatesDocument.Query1]: query1,
}

type QueryProviderTriggerStatesParams = QueryParams<QueryProviderTriggerStatesDocument, QueryProviderTriggerStatesRequest> & {
    request: QueryProviderTriggerStatesRequest
}

/**
 * The switches of one connected account's triggers: one row per trigger its provider declares (its switch, last fire, decider and
 * the agents that may decide), an empty list for a provider with none. Rejects with the back end failure.
 */
export const queryProviderTriggerStates = async ({
    query = QueryProviderTriggerStatesDocument.Query1,
    request,
    signal,
}: QueryProviderTriggerStatesParams): Promise<ApolloClient.QueryResult<QueryProviderTriggerStatesResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
