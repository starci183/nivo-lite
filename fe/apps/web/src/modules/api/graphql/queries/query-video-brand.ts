import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The generated payload of the `videoBrand` query. */
type QueryVideoBrandResponse = Pick<Query, "videoBrand">

type Document = TypedDocumentNode<QueryVideoBrandResponse>

const query1: Document = gql`
    query VideoBrand {
        videoBrand {
            logoPath
            musicTrack
            primary
            secondary
            shopName
            voice
        }
    }
`

enum QueryVideoBrand {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoBrand, Document> = {
    [QueryVideoBrand.Query1]: query1,
}

/** Apollo options for the `videoBrand` query. */
type QueryVideoBrandParams = QueryParams<QueryVideoBrand>

/** Reads `videoBrand` through the authenticated back end GraphQL API. */
export const queryVideoBrand = async ({ query = QueryVideoBrand.Query1, signal }: QueryVideoBrandParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
