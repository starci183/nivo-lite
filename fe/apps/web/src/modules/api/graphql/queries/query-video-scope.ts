import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

/** The generated payload of the `videoScope` query. */
type QueryVideoScopeResponse = Pick<Query, "videoScope">

type Document = TypedDocumentNode<QueryVideoScopeResponse>

const query1: Document = gql`
    query VideoScope {
        videoScope {
            canEdit
            workspaceId
        }
    }
`

enum QueryVideoScope {
    Query1 = "query1",
}

const queryMap: Record<QueryVideoScope, Document> = {
    [QueryVideoScope.Query1]: query1,
}

/** Apollo options for the `videoScope` query. */
type QueryVideoScopeParams = QueryParams<QueryVideoScope>

/** Reads `videoScope` through the authenticated back end GraphQL API. */
export const queryVideoScope = async ({ query = QueryVideoScope.Query1, signal }: QueryVideoScopeParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
    })
}
