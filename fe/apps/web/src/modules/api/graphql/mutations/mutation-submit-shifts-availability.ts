import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    SubmitShiftsAvailabilityMutation,
    SubmitShiftsAvailabilityMutationVariables,
} from "../__generated__/graphql"

/** The input of the `submitShiftsAvailability` mutation. */
export type MutateSubmitShiftsAvailabilityRequest = WireInput<SubmitShiftsAvailabilityMutationVariables["input"]>

/** The response of the `submitShiftsAvailability` mutation. */
type MutateSubmitShiftsAvailabilityResponse = SubmitShiftsAvailabilityMutation

const mutation1: TypedDocumentNode<
    MutateSubmitShiftsAvailabilityResponse,
    InputVariables<MutateSubmitShiftsAvailabilityRequest>
> = gql`
    mutation SubmitShiftsAvailability($input: SaveShiftsAvailabilityInput!) {
        submitShiftsAvailability(input: $input) {
            id
        }
    }
`

enum MutationSubmitShiftsAvailability {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSubmitShiftsAvailability,
    TypedDocumentNode<MutateSubmitShiftsAvailabilityResponse, InputVariables<MutateSubmitShiftsAvailabilityRequest>>
> = {
    [MutationSubmitShiftsAvailability.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSubmitShiftsAvailability}. */
type MutateSubmitShiftsAvailabilityParams = MutateParams<
    MutationSubmitShiftsAvailability,
    MutateSubmitShiftsAvailabilityRequest
>

/** Runs the `submitShiftsAvailability` mutation. */
export const mutateSubmitShiftsAvailability = async ({
    mutation = MutationSubmitShiftsAvailability.Mutation1,
    request,
    signal,
}: MutateSubmitShiftsAvailabilityParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
