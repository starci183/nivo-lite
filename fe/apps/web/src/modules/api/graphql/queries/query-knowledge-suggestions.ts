import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { KnowledgeSuggestionsQuery } from "../__generated__/graphql"

/** The response of the `knowledgeSuggestions` query: the typed payload straight from the back end contract. */
type QueryKnowledgeSuggestionsResponse = KnowledgeSuggestionsQuery

const query1: TypedDocumentNode<QueryKnowledgeSuggestionsResponse> = gql`
    query KnowledgeSuggestions {
        knowledgeSuggestions {
            businessType
            decisions {
                key
                state
            }
        }
    }
`

enum QueryKnowledgeSuggestions {
    Query1 = "query1",
}

const queryMap: Record<QueryKnowledgeSuggestions, TypedDocumentNode<QueryKnowledgeSuggestionsResponse>> = {
    [QueryKnowledgeSuggestions.Query1]: query1,
}

/** Apollo params for {@link queryKnowledgeSuggestions}. */
type QueryKnowledgeSuggestionsParams = QueryParams<QueryKnowledgeSuggestions>

/**
 * Reads the suggestion context of the workspace: its business type and the decisions the owner took on each suggestion
 * (the back end `knowledgeSuggestions` query). Rejects with the back end failure (`CombinedGraphQLErrors`, message
 * localized by the server).
 */
export const queryKnowledgeSuggestions = async ({
    query = QueryKnowledgeSuggestions.Query1,
    signal,
}: QueryKnowledgeSuggestionsParams = {}): Promise<ApolloClient.QueryResult<QueryKnowledgeSuggestionsResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({ query: queryMap[query] })
}
