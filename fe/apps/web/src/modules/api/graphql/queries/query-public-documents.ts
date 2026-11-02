import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { PublicDocumentsQuery } from "../__generated__/graphql"

type QueryPublicDocumentsResponse = PublicDocumentsQuery

const query1: TypedDocumentNode<QueryPublicDocumentsResponse> = gql`
    query PublicDocuments {
        publicDocuments {
            id
            title
            body
            publishedBody
            draftRevision
            status
            kind
            question
            gapId
            sources {
                sourceId
                title
                changed
            }
            leftOut {
                label
                reason
            }
            needsReview
            hasPendingChange
            approvedByName
            approvedAt
            failureCode
            createdAt
            updatedAt
        }
    }
`

enum QueryPublicDocuments {
    Query1 = "query1",
}
const queryMap: Record<QueryPublicDocuments, typeof query1> = { [QueryPublicDocuments.Query1]: query1 }

/** Calls the backend publicDocuments query: the documents written for customers, with their sources, what was left out and who approved them. */
export const queryPublicDocuments = async ({
    query = QueryPublicDocuments.Query1,
    signal,
}: QueryParams<QueryPublicDocuments> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
