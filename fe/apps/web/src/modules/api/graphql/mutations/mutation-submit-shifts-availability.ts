import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSubmitShiftsAvailabilityArgs } from "../__generated__/schema"

/** The input of the `submitShiftsAvailability` mutation. */
export type MutateSubmitShiftsAvailabilityRequest = MutationSubmitShiftsAvailabilityArgs["input"]

/** The response of the `submitShiftsAvailability` mutation. */
type MutateSubmitShiftsAvailabilityResponse = Pick<Mutation, "submitShiftsAvailability">

const mutation1: TypedDocumentNode<MutateSubmitShiftsAvailabilityResponse, InputVariables<MutateSubmitShiftsAvailabilityRequest>> = gql`
    mutation SubmitShiftsAvailability($input: SaveShiftsAvailabilityInput!) {
        submitShiftsAvailability(input: $input) {
            id
        }
    }
`

enum MutationSubmitShiftsAvailability {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSubmitShiftsAvailability, TypedDocumentNode<MutateSubmitShiftsAvailabilityResponse, InputVariables<MutateSubmitShiftsAvailabilityRequest>>> = {
    [MutationSubmitShiftsAvailability.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSubmitShiftsAvailability}. */
type MutateSubmitShiftsAvailabilityParams = MutateParams<MutationSubmitShiftsAvailability, MutateSubmitShiftsAvailabilityRequest>

/** Runs the `submitShiftsAvailability` mutation. */
export const mutateSubmitShiftsAvailability = async ({ mutation = MutationSubmitShiftsAvailability.Mutation1, request, signal }: MutateSubmitShiftsAvailabilityParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
