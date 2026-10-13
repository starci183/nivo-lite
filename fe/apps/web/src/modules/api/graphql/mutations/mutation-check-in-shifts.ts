import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CheckInShiftsMutation, CheckInShiftsMutationVariables } from "../__generated__/graphql"

/** The input of the `checkInShifts` mutation. */
export type MutateCheckInShiftsRequest = WireInput<CheckInShiftsMutationVariables["input"]>

/** The response of the `checkInShifts` mutation. */
type MutateCheckInShiftsResponse = CheckInShiftsMutation

const mutation1: TypedDocumentNode<MutateCheckInShiftsResponse, InputVariables<MutateCheckInShiftsRequest>> = gql`
    mutation CheckInShifts($input: ShiftsShiftRefInput!) {
        checkInShifts(input: $input) {
            at
        }
    }
`

enum MutationCheckInShifts {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCheckInShifts,
    TypedDocumentNode<MutateCheckInShiftsResponse, InputVariables<MutateCheckInShiftsRequest>>
> = {
    [MutationCheckInShifts.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCheckInShifts}. */
type MutateCheckInShiftsParams = MutateParams<MutationCheckInShifts, MutateCheckInShiftsRequest>

/** Runs the `checkInShifts` mutation. */
export const mutateCheckInShifts = async ({
    mutation = MutationCheckInShifts.Mutation1,
    request,
    signal,
}: MutateCheckInShiftsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
