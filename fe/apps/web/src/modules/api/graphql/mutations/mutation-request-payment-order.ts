import { gql, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestPaymentOrderMutation, RequestPaymentOrderMutationVariables } from "../__generated__/graphql"

/** The input of the `requestPaymentOrder` mutation. */
export type MutateRequestPaymentOrderRequest = WireInput<RequestPaymentOrderMutationVariables["input"]>

type MutateRequestPaymentOrderResponse = RequestPaymentOrderMutation

const mutation1: TypedDocumentNode<
    MutateRequestPaymentOrderResponse,
    InputVariables<MutateRequestPaymentOrderRequest>
> = gql`
    mutation RequestPaymentOrder($input: RequestPaymentOrderInput!) {
        requestPaymentOrder(input: $input) {
            id
            status
        }
    }
`

enum MutationRequestPaymentOrder {
    Mutation1 = "mutation1",
}
const mutationMap: Record<MutationRequestPaymentOrder, typeof mutation1> = {
    [MutationRequestPaymentOrder.Mutation1]: mutation1,
}

/** Enqueues backend payment-order creation. */
export const mutateRequestPaymentOrder = async ({
    mutation = MutationRequestPaymentOrder.Mutation1,
    request,
    signal,
}: MutateParams<MutationRequestPaymentOrder, MutateRequestPaymentOrderRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
