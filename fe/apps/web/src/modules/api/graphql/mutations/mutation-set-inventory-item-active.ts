import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetInventoryItemActiveMutation, SetInventoryItemActiveMutationVariables } from "../__generated__/graphql"

/** The input of the `setInventoryItemActive` mutation. */
export type MutateSetInventoryItemActiveRequest = WireInput<SetInventoryItemActiveMutationVariables["input"]>

/** The response of the `setInventoryItemActive` mutation. */
type MutateSetInventoryItemActiveResponse = SetInventoryItemActiveMutation

const mutation1: TypedDocumentNode<
    MutateSetInventoryItemActiveResponse,
    InputVariables<MutateSetInventoryItemActiveRequest>
> = gql`
    mutation SetInventoryItemActive($input: SetInventoryItemActiveInput!) {
        setInventoryItemActive(input: $input)
    }
`

enum MutationSetInventoryItemActive {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetInventoryItemActive,
    TypedDocumentNode<MutateSetInventoryItemActiveResponse, InputVariables<MutateSetInventoryItemActiveRequest>>
> = {
    [MutationSetInventoryItemActive.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSetInventoryItemActive}. */
type MutateSetInventoryItemActiveParams = MutateParams<
    MutationSetInventoryItemActive,
    MutateSetInventoryItemActiveRequest
>

/** Runs the `setInventoryItemActive` mutation. */
export const mutateSetInventoryItemActive = async ({
    mutation = MutationSetInventoryItemActive.Mutation1,
    request,
    signal,
}: MutateSetInventoryItemActiveParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
