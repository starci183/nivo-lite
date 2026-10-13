import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLeadGenCommentStatusArgs } from "../__generated__/schema"

/** The workspace-scoped status lookup and its generated response. */
type QueryLeadGenCommentStatusRequest = QueryLeadGenCommentStatusArgs["input"]

/** The QueryLeadGenCommentStatusResponse of this operation, straight from the generated schema. */
type QueryLeadGenCommentStatusResponse = Pick<Query, "leadGenCommentStatus">

type Document = TypedDocumentNode<QueryLeadGenCommentStatusResponse, InputVariables<QueryLeadGenCommentStatusRequest>>

const query1: Document = gql`
    query LeadGenCommentStatus($input: ReadLeadGenCommentStatusInput!) {
        leadGenCommentStatus(input: $input) {
            id
            status
            workStatus
            resultHref
            errorCode
        }
    }
`

enum QueryLeadGenCommentStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadGenCommentStatus, Document> = { [QueryLeadGenCommentStatus.Query1]: query1 }

/** Apollo params for the QueryLeadGenCommentStatus operation. */
type QueryLeadGenCommentStatusParams = QueryParams<QueryLeadGenCommentStatus, QueryLeadGenCommentStatusRequest> & {
    request: QueryLeadGenCommentStatusRequest
}

/** Reads an approval job until the public reply succeeds or fails. */
export const queryLeadGenCommentStatus = async ({
    query = QueryLeadGenCommentStatus.Query1,
    request,
    signal,
}: QueryLeadGenCommentStatusParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
