import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestShiftsLeaveMutation, RequestShiftsLeaveMutationVariables } from "../__generated__/graphql"

/** The input of the `requestShiftsLeave` mutation. */
export type MutateRequestShiftsLeaveRequest = WireInput<RequestShiftsLeaveMutationVariables["input"]>

/** The response of the `requestShiftsLeave` mutation. */
type MutateRequestShiftsLeaveResponse = RequestShiftsLeaveMutation

const mutation1: TypedDocumentNode<
    MutateRequestShiftsLeaveResponse,
    InputVariables<MutateRequestShiftsLeaveRequest>
> = gql`
    mutation RequestShiftsLeave($input: RequestShiftsLeaveInput!) {
        requestShiftsLeave(input: $input) {
            status
        }
    }
`

enum MutationRequestShiftsLeave {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestShiftsLeave,
    TypedDocumentNode<MutateRequestShiftsLeaveResponse, InputVariables<MutateRequestShiftsLeaveRequest>>
> = {
    [MutationRequestShiftsLeave.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestShiftsLeave}. */
type MutateRequestShiftsLeaveParams = MutateParams<MutationRequestShiftsLeave, MutateRequestShiftsLeaveRequest>

/** Runs the `requestShiftsLeave` mutation. */
export const mutateRequestShiftsLeave = async ({
    mutation = MutationRequestShiftsLeave.Mutation1,
    request,
    signal,
}: MutateRequestShiftsLeaveParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
