import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The generated payload of the `videoSources` query. */
type QueryVideoSourcesResponse = Pick<Query, "videoSources">

type Document = TypedDocumentNode<QueryVideoSourcesResponse>

const query1: Document = gql`
    query VideoSources {
        videoSources {
            excerpt
            id
            title
            topic
        }
    }
`

enum QueryVideoSources {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoSources, Document> = {
    [QueryVideoSources.Query1]: query1,
}

/** Apollo options for the `videoSources` query. */
type QueryVideoSourcesParams = QueryParams<QueryVideoSources>

/** Reads `videoSources` through the authenticated back end GraphQL API. */
export const queryVideoSources = async ({ query = QueryVideoSources.Query1, signal }: QueryVideoSourcesParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
