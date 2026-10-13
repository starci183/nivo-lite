import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationReassignShiftsShiftArgs } from "../__generated__/schema"

/** The input of the `reassignShiftsShift` mutation. */
export type MutateReassignShiftsShiftRequest = MutationReassignShiftsShiftArgs["input"]

/** The response of the `reassignShiftsShift` mutation. */
type MutateReassignShiftsShiftResponse = Pick<Mutation, "reassignShiftsShift">

const mutation1: TypedDocumentNode<
    MutateReassignShiftsShiftResponse,
    InputVariables<MutateReassignShiftsShiftRequest>
> = gql`
    mutation ReassignShiftsShift($input: ReassignShiftsShiftInput!) {
        reassignShiftsShift(input: $input) {
            warnings
        }
    }
`

enum MutationReassignShiftsShift {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationReassignShiftsShift,
    TypedDocumentNode<MutateReassignShiftsShiftResponse, InputVariables<MutateReassignShiftsShiftRequest>>
> = {
    [MutationReassignShiftsShift.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateReassignShiftsShift}. */
type MutateReassignShiftsShiftParams = MutateParams<MutationReassignShiftsShift, MutateReassignShiftsShiftRequest>

/** Runs the `reassignShiftsShift` mutation. */
export const mutateReassignShiftsShift = async ({
    mutation = MutationReassignShiftsShift.Mutation1,
    request,
    signal,
}: MutateReassignShiftsShiftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
