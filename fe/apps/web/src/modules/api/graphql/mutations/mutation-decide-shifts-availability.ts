import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    DecideShiftsAvailabilityMutation,
    DecideShiftsAvailabilityMutationVariables,
} from "../__generated__/graphql"

/** The input of the `decideShiftsAvailability` mutation. */
export type MutateDecideShiftsAvailabilityRequest = WireInput<DecideShiftsAvailabilityMutationVariables["input"]>

/** The response of the `decideShiftsAvailability` mutation. */
type MutateDecideShiftsAvailabilityResponse = DecideShiftsAvailabilityMutation

const mutation1: TypedDocumentNode<
    MutateDecideShiftsAvailabilityResponse,
    InputVariables<MutateDecideShiftsAvailabilityRequest>
> = gql`
    mutation DecideShiftsAvailability($input: DecideShiftsAvailabilityInput!) {
        decideShiftsAvailability(input: $input)
    }
`

enum MutationDecideShiftsAvailability {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideShiftsAvailability,
    TypedDocumentNode<MutateDecideShiftsAvailabilityResponse, InputVariables<MutateDecideShiftsAvailabilityRequest>>
> = {
    [MutationDecideShiftsAvailability.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDecideShiftsAvailability}. */
type MutateDecideShiftsAvailabilityParams = MutateParams<
    MutationDecideShiftsAvailability,
    MutateDecideShiftsAvailabilityRequest
>

/** Runs the `decideShiftsAvailability` mutation. */
export const mutateDecideShiftsAvailability = async ({
    mutation = MutationDecideShiftsAvailability.Mutation1,
    request,
    signal,
}: MutateDecideShiftsAvailabilityParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
