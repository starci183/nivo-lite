import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveInventoryItemArgs } from "../__generated__/schema"

/** The input of the `saveInventoryItem` mutation. */
export type MutateSaveInventoryItemRequest = MutationSaveInventoryItemArgs["input"]

/** The response of the `saveInventoryItem` mutation. */
type MutateSaveInventoryItemResponse = Pick<Mutation, "saveInventoryItem">

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
