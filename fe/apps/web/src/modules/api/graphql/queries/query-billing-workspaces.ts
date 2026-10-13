import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryBillingWorkspacesResponse = Pick<Query, "billingWorkspaces">

const query1: TypedDocumentNode<QueryBillingWorkspacesResponse> = gql`
    query BillingWorkspaces {
        billingWorkspaces {
            id
            name
            status
            planCode
            paidUntil
            role
        }
    }
`

enum QueryBillingWorkspaces {
    Query1 = "query1",
}
const queryMap: Record<QueryBillingWorkspaces, typeof query1> = { [QueryBillingWorkspaces.Query1]: query1 }

/** Calls the backend billingWorkspaces query. */
export const queryBillingWorkspaces = async ({
    query = QueryBillingWorkspaces.Query1,
    signal,
}: QueryParams<QueryBillingWorkspaces> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
