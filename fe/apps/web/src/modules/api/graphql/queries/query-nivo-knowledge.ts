import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The response of the `nivoKnowledge` query: the typed payload straight from the back end contract. */
type QueryNivoKnowledgeResponse = Pick<Query, "nivoKnowledge">

const query1: TypedDocumentNode<QueryNivoKnowledgeResponse> = gql`
    query NivoKnowledge {
        nivoKnowledge {
            body
            id
            kind
            module
            slug
            title
            updatedAt
            version
        }
    }
`

enum QueryNivoKnowledge {
    Query1 = "query1",
}

const queryMap: Record<QueryNivoKnowledge, TypedDocumentNode<QueryNivoKnowledgeResponse>> = {
    [QueryNivoKnowledge.Query1]: query1,
}

/** Apollo params for {@link queryNivoKnowledge}. */
type QueryNivoKnowledgeParams = QueryParams<QueryNivoKnowledge>

/**
 * Lists the base knowledge of NIVO every workspace reads (the back end `nivoKnowledge` query). Rejects with the back end
 * failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const queryNivoKnowledge = async ({
    query = QueryNivoKnowledge.Query1,
    signal,
}: QueryNivoKnowledgeParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
