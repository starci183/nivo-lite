import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { AgentCatalogQuery } from "../__generated__/graphql"

/** The response of the `agentCatalog` query: the typed payload straight from the back end contract. */
type QueryAgentCatalogResponse = AgentCatalogQuery

const query1: TypedDocumentNode<QueryAgentCatalogResponse> = gql`
    query AgentCatalog {
        agentCatalog {
            agentId
            grants {
                accountMasked
                botUsername
                connectionId
                name
                provider
                purpose
                status
            }
            installationId
            knowledge {
                audience
                documents
                factsApproved
                factsTotal
                factsWaiting
            }
        }
    }
`

enum QueryAgentCatalog {
    Query1 = "query1",
}

const queryMap: Record<QueryAgentCatalog, TypedDocumentNode<QueryAgentCatalogResponse>> = {
    [QueryAgentCatalog.Query1]: query1,
}

/** Apollo params for {@link queryAgentCatalog}. */
type QueryAgentCatalogParams = QueryParams<QueryAgentCatalog>

/**
 * Every agent of the workspace with the connections granted to it and what it reads (the back end `agentCatalog` query, any
 * member): one read for the whole catalogue. Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryAgentCatalog = async ({
    query = QueryAgentCatalog.Query1,
    signal,
}: QueryAgentCatalogParams = {}): Promise<ApolloClient.QueryResult<QueryAgentCatalogResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], fetchPolicy: "no-cache" })
}
