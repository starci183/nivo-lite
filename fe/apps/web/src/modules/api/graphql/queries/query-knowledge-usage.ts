import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { KnowledgeUsageQuery } from "../__generated__/graphql"

type QueryKnowledgeUsageResponse = KnowledgeUsageQuery

const query1: TypedDocumentNode<QueryKnowledgeUsageResponse> = gql`
    query KnowledgeUsage {
        knowledgeUsage {
            documents {
                usedBytes
                limitBytes
                count
            }
            truths {
                count
                limitCount
                usedBytes
                limitBytes
            }
            limitBytes
            limitMb
            truthBytes
            truthBytesCeiling
            truthsCeiling
            truthsInForce
            usedBytes
            usedMb
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
}: QueryParams<QueryKnowledgeUsage> = {}): Promise<ApolloClient.QueryResult<QueryKnowledgeUsageResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
