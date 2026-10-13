import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSetInventoryItemActiveArgs } from "../__generated__/schema"

/** The input of the `setInventoryItemActive` mutation. */
export type MutateSetInventoryItemActiveRequest = MutationSetInventoryItemActiveArgs["input"]

/** The response of the `setInventoryItemActive` mutation. */
type MutateSetInventoryItemActiveResponse = Pick<Mutation, "setInventoryItemActive">

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
