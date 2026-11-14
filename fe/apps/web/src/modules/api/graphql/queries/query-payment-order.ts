import { gql, type TypedDocumentNode, type ApolloClient } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type QueryParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { PaymentOrderQuery, PaymentOrderQueryVariables } from "../__generated__/graphql"

type QueryPaymentOrderRequest = WireInput<PaymentOrderQueryVariables["input"]>
type QueryPaymentOrderResponse = PaymentOrderQuery

type QueryPaymentOrderParams = QueryParams<QueryPaymentOrder, QueryPaymentOrderRequest> & {
    request: QueryPaymentOrderRequest
}

const query1: TypedDocumentNode<QueryPaymentOrderResponse, InputVariables<QueryPaymentOrderRequest>> = gql`
    query PaymentOrder($input: PaymentOrderInput!) {
        paymentOrder(input: $input) {
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

enum QueryPaymentOrder {
    Query1 = "query1",
}
const queryMap: Record<QueryPaymentOrder, typeof query1> = { [QueryPaymentOrder.Query1]: query1 }

/** Calls the backend paymentOrder query. */
export const queryPaymentOrder = async ({
    query = QueryPaymentOrder.Query1,
    request,
    signal,
}: QueryPaymentOrderParams): Promise<ApolloClient.QueryResult<QueryPaymentOrderResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.query({
        query: queryMap[query],
        variables: { input: request },
    })
}
