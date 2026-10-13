import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveInventoryRecipeMutation, SaveInventoryRecipeMutationVariables } from "../__generated__/graphql"

/** The input of the `saveInventoryRecipe` mutation. */
export type MutateSaveInventoryRecipeRequest = WireInput<SaveInventoryRecipeMutationVariables["input"]>

/** The response of the `saveInventoryRecipe` mutation. */
type MutateSaveInventoryRecipeResponse = SaveInventoryRecipeMutation

const mutation1: TypedDocumentNode<
    MutateSaveInventoryRecipeResponse,
    InputVariables<MutateSaveInventoryRecipeRequest>
> = gql`
    mutation SaveInventoryRecipe($input: SaveInventoryRecipeInput!) {
        saveInventoryRecipe(input: $input) {
            id
        }
    }
`

enum MutationSaveInventoryRecipe {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveInventoryRecipe,
    TypedDocumentNode<MutateSaveInventoryRecipeResponse, InputVariables<MutateSaveInventoryRecipeRequest>>
> = {
    [MutationSaveInventoryRecipe.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveInventoryRecipe}. */
type MutateSaveInventoryRecipeParams = MutateParams<MutationSaveInventoryRecipe, MutateSaveInventoryRecipeRequest>

/** Runs the `saveInventoryRecipe` mutation. */
export const mutateSaveInventoryRecipe = async ({
    mutation = MutationSaveInventoryRecipe.Mutation1,
    request,
    signal,
}: MutateSaveInventoryRecipeParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
