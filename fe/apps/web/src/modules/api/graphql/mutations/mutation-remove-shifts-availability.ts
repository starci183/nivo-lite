import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RemoveShiftsAvailabilityMutation,
    RemoveShiftsAvailabilityMutationVariables,
} from "../__generated__/graphql"

/** The input of the `removeShiftsAvailability` mutation. */
export type MutateRemoveShiftsAvailabilityRequest = WireInput<RemoveShiftsAvailabilityMutationVariables["input"]>

/** The response of the `removeShiftsAvailability` mutation. */
type MutateRemoveShiftsAvailabilityResponse = RemoveShiftsAvailabilityMutation

const mutation1: TypedDocumentNode<
    MutateRemoveShiftsAvailabilityResponse,
    InputVariables<MutateRemoveShiftsAvailabilityRequest>
> = gql`
    mutation RemoveShiftsAvailability($input: ShiftsAvailabilityRefInput!) {
        removeShiftsAvailability(input: $input)
    }
`

enum MutationRemoveShiftsAvailability {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRemoveShiftsAvailability,
    TypedDocumentNode<MutateRemoveShiftsAvailabilityResponse, InputVariables<MutateRemoveShiftsAvailabilityRequest>>
> = {
    [MutationRemoveShiftsAvailability.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveShiftsAvailability}. */
type MutateRemoveShiftsAvailabilityParams = MutateParams<
    MutationRemoveShiftsAvailability,
    MutateRemoveShiftsAvailabilityRequest
>

/** Runs the `removeShiftsAvailability` mutation. */
export const mutateRemoveShiftsAvailability = async ({
    mutation = MutationRemoveShiftsAvailability.Mutation1,
    request,
    signal,
}: MutateRemoveShiftsAvailabilityParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
