import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { AgentKnowledgeLensesQuery } from "../__generated__/graphql"

/** The response of the `agentKnowledgeLenses` query: the typed payload straight from the back end contract. */
type QueryAgentKnowledgeLensesResponse = AgentKnowledgeLensesQuery

const query1: TypedDocumentNode<QueryAgentKnowledgeLensesResponse> = gql`
    query AgentKnowledgeLenses {
        agentKnowledgeLenses {
            agentId
            audience
            avatarUrl
            installationId
            kind
            lanes {
                count
                lane
                open
            }
            module
            name
        }
    }
`

enum QueryAgentKnowledgeLenses {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentKnowledgeLenses, TypedDocumentNode<QueryAgentKnowledgeLensesResponse>> = {
    [QueryAgentKnowledgeLenses.Query1]: query1,
}

/** Apollo params for {@link queryAgentKnowledgeLenses}. */
type QueryAgentKnowledgeLensesParams = QueryParams<QueryAgentKnowledgeLenses>

/**
 * What the customer and every active agent may read of the shared knowledge (the back end `agentKnowledgeLenses` query,
 * any member). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryAgentKnowledgeLenses = async ({
    query = QueryAgentKnowledgeLenses.Query1,
    signal,
}: QueryAgentKnowledgeLensesParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
