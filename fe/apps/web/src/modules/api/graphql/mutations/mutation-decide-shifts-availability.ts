import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDecideShiftsAvailabilityArgs } from "../__generated__/schema"

/** The input of the `decideShiftsAvailability` mutation. */
export type MutateDecideShiftsAvailabilityRequest = MutationDecideShiftsAvailabilityArgs["input"]

/** The response of the `decideShiftsAvailability` mutation. */
type MutateDecideShiftsAvailabilityResponse = Pick<Mutation, "decideShiftsAvailability">

const mutation1: TypedDocumentNode<MutateDecideShiftsAvailabilityResponse, InputVariables<MutateDecideShiftsAvailabilityRequest>> = gql`
    mutation DecideShiftsAvailability($input: DecideShiftsAvailabilityInput!) {
        decideShiftsAvailability(input: $input)
    }
`

enum MutationDecideShiftsAvailability {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDecideShiftsAvailability, TypedDocumentNode<MutateDecideShiftsAvailabilityResponse, InputVariables<MutateDecideShiftsAvailabilityRequest>>> = {
    [MutationDecideShiftsAvailability.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDecideShiftsAvailability}. */
type MutateDecideShiftsAvailabilityParams = MutateParams<MutationDecideShiftsAvailability, MutateDecideShiftsAvailabilityRequest>

/** Runs the `decideShiftsAvailability` mutation. */
export const mutateDecideShiftsAvailability = async ({ mutation = MutationDecideShiftsAvailability.Mutation1, request, signal }: MutateDecideShiftsAvailabilityParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
