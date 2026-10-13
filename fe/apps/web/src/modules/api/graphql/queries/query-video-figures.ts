import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { VideoFiguresQuery } from "../__generated__/graphql"

/** The generated payload of the `videoFigures` query. */
type QueryVideoFiguresResponse = VideoFiguresQuery

type Document = TypedDocumentNode<QueryVideoFiguresResponse>

const query1: Document = gql`
    query VideoFigures {
        videoFigures {
            approved
            credits30
            published30
            readyToPublish
            rendering
            scripting
        }
    }
`

enum QueryVideoFigures {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoFigures, Document> = {
    [QueryVideoFigures.Query1]: query1,
}

/** Apollo options for the `videoFigures` query. */
type QueryVideoFiguresParams = QueryParams<QueryVideoFigures>

/** Reads `videoFigures` through the authenticated back end GraphQL API. */
export const queryVideoFigures = async ({ query = QueryVideoFigures.Query1, signal }: QueryVideoFiguresParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
