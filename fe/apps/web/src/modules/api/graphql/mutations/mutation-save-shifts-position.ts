import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveShiftsPositionMutation, SaveShiftsPositionMutationVariables } from "../__generated__/graphql"

/** The input of the `saveShiftsPosition` mutation. */
export type MutateSaveShiftsPositionRequest = WireInput<SaveShiftsPositionMutationVariables["input"]>

/** The response of the `saveShiftsPosition` mutation. */
type MutateSaveShiftsPositionResponse = SaveShiftsPositionMutation

const mutation1: TypedDocumentNode<
    MutateSaveShiftsPositionResponse,
    InputVariables<MutateSaveShiftsPositionRequest>
> = gql`
    mutation SaveShiftsPosition($input: SaveShiftsPositionInput!) {
        saveShiftsPosition(input: $input) {
            id
        }
    }
`

enum MutationSaveShiftsPosition {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveShiftsPosition,
    TypedDocumentNode<MutateSaveShiftsPositionResponse, InputVariables<MutateSaveShiftsPositionRequest>>
> = {
    [MutationSaveShiftsPosition.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveShiftsPosition}. */
type MutateSaveShiftsPositionParams = MutateParams<MutationSaveShiftsPosition, MutateSaveShiftsPositionRequest>

/** Runs the `saveShiftsPosition` mutation. */
export const mutateSaveShiftsPosition = async ({
    mutation = MutationSaveShiftsPosition.Mutation1,
    request,
    signal,
}: MutateSaveShiftsPositionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
