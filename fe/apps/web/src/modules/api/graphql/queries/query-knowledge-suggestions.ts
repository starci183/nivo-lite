import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `knowledgeSuggestions` query: the typed payload straight from the back end contract. */
type QueryKnowledgeSuggestionsResponse = Pick<Query, "knowledgeSuggestions">

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
}: QueryKnowledgeSuggestionsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
