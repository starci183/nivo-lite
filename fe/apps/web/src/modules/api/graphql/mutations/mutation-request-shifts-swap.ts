import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestShiftsSwapMutation, RequestShiftsSwapMutationVariables } from "../__generated__/graphql"

/** The input of the `requestShiftsSwap` mutation. */
export type MutateRequestShiftsSwapRequest = WireInput<RequestShiftsSwapMutationVariables["input"]>

/** The response of the `requestShiftsSwap` mutation. */
type MutateRequestShiftsSwapResponse = RequestShiftsSwapMutation

const mutation1: TypedDocumentNode<
    MutateRequestShiftsSwapResponse,
    InputVariables<MutateRequestShiftsSwapRequest>
> = gql`
    mutation RequestShiftsSwap($input: RequestShiftsSwapInput!) {
        requestShiftsSwap(input: $input) {
            status
        }
    }
`

enum MutationRequestShiftsSwap {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestShiftsSwap,
    TypedDocumentNode<MutateRequestShiftsSwapResponse, InputVariables<MutateRequestShiftsSwapRequest>>
> = {
    [MutationRequestShiftsSwap.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestShiftsSwap}. */
type MutateRequestShiftsSwapParams = MutateParams<MutationRequestShiftsSwap, MutateRequestShiftsSwapRequest>

/** Runs the `requestShiftsSwap` mutation. */
export const mutateRequestShiftsSwap = async ({
    mutation = MutationRequestShiftsSwap.Mutation1,
    request,
    signal,
}: MutateRequestShiftsSwapParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
