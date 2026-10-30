import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { KnowledgeUsageQuery } from "../__generated__/graphql"

type QueryKnowledgeUsageResponse = KnowledgeUsageQuery

const query1: TypedDocumentNode<QueryKnowledgeUsageResponse> = gql`
    query KnowledgeUsage {
        knowledgeUsage {
            limitBytes
            usedBytes
        }
    }
`

enum QueryKnowledgeUsage {
    Query1 = "query1",
}
const queryMap: Record<QueryKnowledgeUsage, typeof query1> = { [QueryKnowledgeUsage.Query1]: query1 }

/** Calls the backend knowledgeUsage query: the raw document bytes the active workspace holds against its 50 MB allowance. */
export const queryKnowledgeUsage = async ({
    query = QueryKnowledgeUsage.Query1,
    signal,
}: QueryParams<QueryKnowledgeUsage> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
