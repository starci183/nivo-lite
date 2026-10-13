import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DeleteInventoryRecipeMutation, DeleteInventoryRecipeMutationVariables } from "../__generated__/graphql"

/** The input of the `deleteInventoryRecipe` mutation. */
export type MutateDeleteInventoryRecipeRequest = WireInput<DeleteInventoryRecipeMutationVariables["input"]>

/** The response of the `deleteInventoryRecipe` mutation. */
type MutateDeleteInventoryRecipeResponse = DeleteInventoryRecipeMutation

const mutation1: TypedDocumentNode<
    MutateDeleteInventoryRecipeResponse,
    InputVariables<MutateDeleteInventoryRecipeRequest>
> = gql`
    mutation DeleteInventoryRecipe($input: InventoryRecipeRefInput!) {
        deleteInventoryRecipe(input: $input)
    }
`

enum MutationDeleteInventoryRecipe {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDeleteInventoryRecipe,
    TypedDocumentNode<MutateDeleteInventoryRecipeResponse, InputVariables<MutateDeleteInventoryRecipeRequest>>
> = {
    [MutationDeleteInventoryRecipe.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeleteInventoryRecipe}. */
type MutateDeleteInventoryRecipeParams = MutateParams<MutationDeleteInventoryRecipe, MutateDeleteInventoryRecipeRequest>

/** Runs the `deleteInventoryRecipe` mutation. */
export const mutateDeleteInventoryRecipe = async ({
    mutation = MutationDeleteInventoryRecipe.Mutation1,
    request,
    signal,
}: MutateDeleteInventoryRecipeParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
