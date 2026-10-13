import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryContentMediaArgs } from "../__generated__/schema"

/** The input of the `contentMedia` query. */
export type QueryContentMediaRequest = QueryContentMediaArgs["input"]

/** The generated payload of the `contentMedia` query. */
type QueryContentMediaResponse = Pick<Query, "contentMedia">

type Document = TypedDocumentNode<QueryContentMediaResponse, InputVariables<QueryContentMediaRequest>>

const query1: Document = gql`
    query ContentMedia($input: ContentMediaInput!) {
        contentMedia(input: $input) {
            library {
                kind
                name
                path
            }
            urls {
                download
                key
                view
            }
            videos {
                createdAt
                durationMs
                id
                name
            }
        }
    }
`

enum QueryContentMedia {
    Query1 = "query1",
}

const queryMap: Record<QueryContentMedia, Document> = {
    [QueryContentMedia.Query1]: query1,
}

/** Apollo options for the `contentMedia` query. */
type QueryContentMediaParams = QueryParams<QueryContentMedia, QueryContentMediaRequest> & {
    request: QueryContentMediaRequest
}

/** Runs `contentMedia` through the authenticated back end GraphQL API. */
export const queryContentMedia = async ({
    query = QueryContentMedia.Query1,
    request,
    signal,
}: QueryContentMediaParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query], variables: { input: request }, fetchPolicy: "no-cache" })
}
