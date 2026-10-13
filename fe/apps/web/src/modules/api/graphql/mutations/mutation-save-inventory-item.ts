import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveInventoryItemMutation, SaveInventoryItemMutationVariables } from "../__generated__/graphql"

/** The input of the `saveInventoryItem` mutation. */
export type MutateSaveInventoryItemRequest = WireInput<SaveInventoryItemMutationVariables["input"]>

/** The response of the `saveInventoryItem` mutation. */
type MutateSaveInventoryItemResponse = SaveInventoryItemMutation

const mutation1: TypedDocumentNode<
    MutateSaveInventoryItemResponse,
    InputVariables<MutateSaveInventoryItemRequest>
> = gql`
    mutation SaveInventoryItem($input: SaveInventoryItemInput!) {
        saveInventoryItem(input: $input) {
            id
        }
    }
`

enum MutationSaveInventoryItem {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveInventoryItem,
    TypedDocumentNode<MutateSaveInventoryItemResponse, InputVariables<MutateSaveInventoryItemRequest>>
> = {
    [MutationSaveInventoryItem.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveInventoryItem}. */
type MutateSaveInventoryItemParams = MutateParams<MutationSaveInventoryItem, MutateSaveInventoryItemRequest>

/** Runs the `saveInventoryItem` mutation. */
export const mutateSaveInventoryItem = async ({
    mutation = MutationSaveInventoryItem.Mutation1,
    request,
    signal,
}: MutateSaveInventoryItemParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
