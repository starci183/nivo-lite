import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryOfficeDecidedApprovalsResponse = Pick<Query, "officeDecidedApprovals">

const query1: TypedDocumentNode<QueryOfficeDecidedApprovalsResponse, Record<string, never>> = gql`
    query OfficeDecidedApprovals {
        officeDecidedApprovals {
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

enum QueryOfficeDecidedApprovals {
    Query1 = "query1",
}

const queryMap: Record<
    QueryOfficeDecidedApprovals,
    TypedDocumentNode<QueryOfficeDecidedApprovalsResponse, Record<string, never>>
> = {
    [QueryOfficeDecidedApprovals.Query1]: query1,
}

type QueryOfficeDecidedApprovalsParams = QueryParams<QueryOfficeDecidedApprovals>

/** The back end `officeDecidedApprovals` query. Rejects with the back end failure (message localized by the server). */
export const queryOfficeDecidedApprovals = async ({
    query = QueryOfficeDecidedApprovals.Query1,
    signal,
}: QueryOfficeDecidedApprovalsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({ query: queryMap[query] })
}
