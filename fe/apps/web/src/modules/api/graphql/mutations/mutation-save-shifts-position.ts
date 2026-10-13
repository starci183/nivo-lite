import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveShiftsPositionArgs } from "../__generated__/schema"

/** The input of the `saveShiftsPosition` mutation. */
export type MutateSaveShiftsPositionRequest = MutationSaveShiftsPositionArgs["input"]

/** The response of the `saveShiftsPosition` mutation. */
type MutateSaveShiftsPositionResponse = Pick<Mutation, "saveShiftsPosition">

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
