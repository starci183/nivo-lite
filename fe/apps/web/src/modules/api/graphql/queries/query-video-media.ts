import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The generated payload of the `videoMedia` query. */
type QueryVideoMediaResponse = Pick<Query, "videoMedia">

type Document = TypedDocumentNode<QueryVideoMediaResponse>

const query1: Document = gql`
    query VideoMedia {
        videoMedia {
            kind
            name
            path
            url
        }
    }
`

enum QueryVideoMedia {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoMedia, Document> = {
    [QueryVideoMedia.Query1]: query1,
}

/** Apollo options for the `videoMedia` query. */
type QueryVideoMediaParams = QueryParams<QueryVideoMedia>

/** Reads `videoMedia` through the authenticated back end GraphQL API. */
export const queryVideoMedia = async ({ query = QueryVideoMedia.Query1, signal }: QueryVideoMediaParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
