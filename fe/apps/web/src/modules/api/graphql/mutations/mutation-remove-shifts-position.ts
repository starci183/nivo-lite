import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRemoveShiftsPositionArgs } from "../__generated__/schema"

/** The input of the `removeShiftsPosition` mutation. */
export type MutateRemoveShiftsPositionRequest = MutationRemoveShiftsPositionArgs["input"]

/** The response of the `removeShiftsPosition` mutation. */
type MutateRemoveShiftsPositionResponse = Pick<Mutation, "removeShiftsPosition">

const mutation1: TypedDocumentNode<MutateRemoveShiftsPositionResponse, InputVariables<MutateRemoveShiftsPositionRequest>> = gql`
    mutation RemoveShiftsPosition($input: ShiftsPositionRefInput!) {
        removeShiftsPosition(input: $input)
    }
`

enum MutationRemoveShiftsPosition {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRemoveShiftsPosition, TypedDocumentNode<MutateRemoveShiftsPositionResponse, InputVariables<MutateRemoveShiftsPositionRequest>>> = {
    [MutationRemoveShiftsPosition.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveShiftsPosition}. */
type MutateRemoveShiftsPositionParams = MutateParams<MutationRemoveShiftsPosition, MutateRemoveShiftsPositionRequest>

/** Runs the `removeShiftsPosition` mutation. */
export const mutateRemoveShiftsPosition = async ({ mutation = MutationRemoveShiftsPosition.Mutation1, request, signal }: MutateRemoveShiftsPositionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
