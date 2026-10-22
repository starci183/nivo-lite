import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { ApproverDirectoryQuery } from "../__generated__/graphql"

type QueryApproverDirectoryResponse = ApproverDirectoryQuery

const query1: TypedDocumentNode<QueryApproverDirectoryResponse, Record<string, never>> = gql`
    query ApproverDirectory {
        approverDirectory {
            memberId
            name
            role
            rooms
            status
        }
    }
`

enum QueryApproverDirectory {
    Query1 = "query1",
}

const queryMap: Record<
    QueryApproverDirectory,
    TypedDocumentNode<QueryApproverDirectoryResponse, Record<string, never>>
> = {
    [QueryApproverDirectory.Query1]: query1,
}

type QueryApproverDirectoryParams = QueryParams<QueryApproverDirectory>

/** The back end `approverDirectory` query: everyone an approver group can name. Rejects with the back end failure (message localized by the server). */
export const queryApproverDirectory = async ({
    query = QueryApproverDirectory.Query1,
    signal,
}: QueryApproverDirectoryParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
