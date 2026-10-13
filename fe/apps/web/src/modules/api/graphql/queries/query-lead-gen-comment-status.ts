import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, QueryParams } from "../types"
import type { Query, QueryLeadGenCommentStatusArgs } from "../__generated__/schema"

/** Generated input of the leadGenCommentStatus query. */
type QueryLeadGenCommentStatusRequest = QueryLeadGenCommentStatusArgs["input"]

/** Generated response of the leadGenCommentStatus query. */
type QueryLeadGenCommentStatusResponse = Pick<Query, "leadGenCommentStatus">

type Document = TypedDocumentNode<QueryLeadGenCommentStatusResponse, InputVariables<QueryLeadGenCommentStatusRequest>>

const query1: Document = gql`
    query LeadGenCommentStatus($input: ReadLeadGenCommentStatusInput!) {
        leadGenCommentStatus(input: $input) {
            errorCode
            id
            resultHref
            status
            workStatus
        }
    }
`

enum QueryLeadGenCommentStatus {
    Query1 = "query1",
}

const queryMap: Record<QueryLeadGenCommentStatus, Document> = {
    [QueryLeadGenCommentStatus.Query1]: query1,
}

/** Apollo parameters for the leadGenCommentStatus query. */
type QueryLeadGenCommentStatusParams = QueryParams<QueryLeadGenCommentStatus, QueryLeadGenCommentStatusRequest> & {
    request: QueryLeadGenCommentStatusRequest
}

/** Runs the workspace-scoped leadGenCommentStatus query through the authenticated GraphQL client. */
export const queryLeadGenCommentStatus = async ({
    query = QueryLeadGenCommentStatus.Query1,
    request,
    signal,
    headers,
}: QueryLeadGenCommentStatusParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.query({
        query: queryMap[query],
        fetchPolicy: "no-cache",
        variables: { input: request },
    })
}
