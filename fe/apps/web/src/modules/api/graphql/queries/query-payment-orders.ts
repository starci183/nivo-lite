import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type QueryParams } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { PaymentOrdersQuery } from "../__generated__/graphql"

type QueryPaymentOrdersResponse = PaymentOrdersQuery

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

enum QueryPaymentOrders {
    Query1 = "query1",
}
const queryMap: Record<QueryPaymentOrders, typeof query1> = { [QueryPaymentOrders.Query1]: query1 }

/** Calls the backend paymentOrders query. */
export const queryPaymentOrders = async ({
    query = QueryPaymentOrders.Query1,
    signal,
}: QueryParams<QueryPaymentOrders> = {}): Promise<ApolloClient.QueryResult<QueryPaymentOrdersResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
    })
}
