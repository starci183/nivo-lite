import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryOpenPlanPaymentOrderResponse = Pick<Query, "openPlanPaymentOrder">

const query1: TypedDocumentNode<QueryOpenPlanPaymentOrderResponse> = gql`
    query OpenPlanPaymentOrder {
        openPlanPaymentOrder {
            id
            workspaceId
            planCode
            amountVnd
            orderCode
            status
            expiresAt
            paidAt
            createdAt
            kind
            packCode
            detail {
                credit
                credits
                daysLeft
                from
                fromPrice
                paidUntil
                to
                toPrice
                cycle
                tierCredits
                seats
                promo
            }
            qrUrl
            bank {
                account
                bank
                holder
            }
        }
    }
`

enum QueryOpenPlanPaymentOrder {
    Query1 = "query1",
}
const queryMap: Record<QueryOpenPlanPaymentOrder, typeof query1> = { [QueryOpenPlanPaymentOrder.Query1]: query1 }

/** Calls the backend openPlanPaymentOrder query. */
export const queryOpenPlanPaymentOrder = async ({
    query = QueryOpenPlanPaymentOrder.Query1,
    signal,
}: QueryParams<QueryOpenPlanPaymentOrder> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
