import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestShiftsLeaveArgs } from "../__generated__/schema"

/** The input of the `requestShiftsLeave` mutation. */
export type MutateRequestShiftsLeaveRequest = MutationRequestShiftsLeaveArgs["input"]

/** The response of the `requestShiftsLeave` mutation. */
type MutateRequestShiftsLeaveResponse = Pick<Mutation, "requestShiftsLeave">

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
