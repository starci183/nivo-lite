import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { QueryParams } from "../types"
import type { Query } from "../__generated__/schema"

type QueryPaymentOrdersResponse = Pick<Query, "paymentOrders">

const query1: TypedDocumentNode<QueryPaymentOrdersResponse> = gql`
    query PaymentOrders {
        paymentOrders {
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

enum QueryPaymentOrders {
    Query1 = "query1",
}
const queryMap: Record<QueryPaymentOrders, typeof query1> = { [QueryPaymentOrders.Query1]: query1 }

/** Calls the backend paymentOrders query. */
export const queryPaymentOrders = async ({
    query = QueryPaymentOrders.Query1,
    signal,
}: QueryParams<QueryPaymentOrders> = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.query({
        query: queryMap[query],
    })
}
