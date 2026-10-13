import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryBillingWorkspaceResponse = Pick<Query, "billingWorkspace">

const query1: TypedDocumentNode<QueryBillingWorkspaceResponse> = gql`
    query BillingWorkspace {
        billingWorkspace {
            id
            name
            status
            planCode
            paidUntil
            tierCredits
            seatCount
            billingCycle
            billedMonthlyVnd
            role
        }
    }
`

enum QueryBillingWorkspace {
    Query1 = "query1",
}
const queryMap: Record<QueryBillingWorkspace, typeof query1> = { [QueryBillingWorkspace.Query1]: query1 }

/** Calls the backend billingWorkspace query. */
export const queryBillingWorkspace = async ({
    query = QueryBillingWorkspace.Query1,
    signal,
}: QueryParams<QueryBillingWorkspace> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
