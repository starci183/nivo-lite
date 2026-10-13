import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveHiringAvailabilityArgs } from "../__generated__/schema"

/** The input of the `saveHiringAvailability` mutation. */
export type MutateSaveHiringAvailabilityRequest = MutationSaveHiringAvailabilityArgs["input"]

/** The response of the `saveHiringAvailability` mutation. */
type MutateSaveHiringAvailabilityResponse = Pick<Mutation, "saveHiringAvailability">

const mutation1: TypedDocumentNode<
    MutateSaveHiringAvailabilityResponse,
    InputVariables<MutateSaveHiringAvailabilityRequest>
> = gql`
    mutation SaveHiringAvailability($input: SaveHiringAvailabilityInput!) {
        saveHiringAvailability(input: $input) {
            saved
        }
    }
`

enum MutationSaveHiringAvailability {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveHiringAvailability,
    TypedDocumentNode<MutateSaveHiringAvailabilityResponse, InputVariables<MutateSaveHiringAvailabilityRequest>>
> = {
    [MutationSaveHiringAvailability.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveHiringAvailability}. */
type MutateSaveHiringAvailabilityParams = MutateParams<
    MutationSaveHiringAvailability,
    MutateSaveHiringAvailabilityRequest
>

/** Runs the `saveHiringAvailability` mutation. */
export const mutateSaveHiringAvailability = async ({
    mutation = MutationSaveHiringAvailability.Mutation1,
    request,
    signal,
}: MutateSaveHiringAvailabilityParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
