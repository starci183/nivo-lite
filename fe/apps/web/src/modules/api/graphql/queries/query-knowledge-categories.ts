import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { KnowledgeCategoriesQuery } from "../__generated__/graphql"

type QueryKnowledgeCategoriesResponse = KnowledgeCategoriesQuery

const query1: TypedDocumentNode<QueryKnowledgeCategoriesResponse> = gql`
    query KnowledgeCategories {
        knowledgeCategories {
            topic
            order
            documentCount
            sizeBytes
        }
    }
`

enum QueryKnowledgeCategories {
    Query1 = "query1",
}
const queryMap: Record<QueryKnowledgeCategories, typeof query1> = { [QueryKnowledgeCategories.Query1]: query1 }

/** Calls the backend knowledgeCategories query: how many documents and raw bytes each category (topic) of the active workspace holds. */
export const queryKnowledgeCategories = async ({
    query = QueryKnowledgeCategories.Query1,
    signal,
}: QueryParams<QueryKnowledgeCategories> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
