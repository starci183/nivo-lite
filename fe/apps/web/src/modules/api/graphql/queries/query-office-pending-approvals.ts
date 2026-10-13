import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { OfficePendingApprovalsQuery } from "../__generated__/graphql"

type QueryOfficePendingApprovalsResponse = OfficePendingApprovalsQuery

const query1: TypedDocumentNode<QueryOfficePendingApprovalsResponse, Record<string, never>> = gql`
    query OfficePendingApprovals {
        officePendingApprovals {
            agentName
            agent_id
            assignedStaffId
            channel
            created_at
            decided_at
            decided_by
            draft
            id
            kind
            leadId
            leadName
            nextAction
            responsibility_id
            status
            work_item_id
        }
    }
`

enum QueryOfficePendingApprovals {
    Query1 = "query1",
}

const queryMap: Record<
    QueryOfficePendingApprovals,
    TypedDocumentNode<QueryOfficePendingApprovalsResponse, Record<string, never>>
> = {
    [QueryOfficePendingApprovals.Query1]: query1,
}

type QueryOfficePendingApprovalsParams = QueryParams<QueryOfficePendingApprovals>

/** The back end `officePendingApprovals` query. Rejects with the back end failure (message localized by the server). */
export const queryOfficePendingApprovals = async ({
    query = QueryOfficePendingApprovals.Query1,
    signal,
}: QueryOfficePendingApprovalsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
