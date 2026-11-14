import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { BillingWorkspaceQuery } from "../__generated__/graphql"

type QueryBillingWorkspaceResponse = BillingWorkspaceQuery

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
}: QueryParams<QueryBillingWorkspace> = {}): Promise<ApolloClient.QueryResult<QueryBillingWorkspaceResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
