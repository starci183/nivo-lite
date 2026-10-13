import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AddShiftsAvailabilityMutation, AddShiftsAvailabilityMutationVariables } from "../__generated__/graphql"

/** The input of the `addShiftsAvailability` mutation. */
export type MutateAddShiftsAvailabilityRequest = WireInput<AddShiftsAvailabilityMutationVariables["input"]>

/** The response of the `addShiftsAvailability` mutation. */
type MutateAddShiftsAvailabilityResponse = AddShiftsAvailabilityMutation

const mutation1: TypedDocumentNode<
    MutateAddShiftsAvailabilityResponse,
    InputVariables<MutateAddShiftsAvailabilityRequest>
> = gql`
    mutation AddShiftsAvailability($input: SaveShiftsAvailabilityInput!) {
        addShiftsAvailability(input: $input) {
            id
        }
    }
`

enum MutationAddShiftsAvailability {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAddShiftsAvailability,
    TypedDocumentNode<MutateAddShiftsAvailabilityResponse, InputVariables<MutateAddShiftsAvailabilityRequest>>
> = {
    [MutationAddShiftsAvailability.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAddShiftsAvailability}. */
type MutateAddShiftsAvailabilityParams = MutateParams<MutationAddShiftsAvailability, MutateAddShiftsAvailabilityRequest>

/** Runs the `addShiftsAvailability` mutation. */
export const mutateAddShiftsAvailability = async ({
    mutation = MutationAddShiftsAvailability.Mutation1,
    request,
    signal,
}: MutateAddShiftsAvailabilityParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
