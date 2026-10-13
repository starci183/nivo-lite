import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveInventorySupplierMutation, SaveInventorySupplierMutationVariables } from "../__generated__/graphql"

/** The input of the `saveInventorySupplier` mutation. */
export type MutateSaveInventorySupplierRequest = WireInput<SaveInventorySupplierMutationVariables["input"]>

/** The response of the `saveInventorySupplier` mutation. */
type MutateSaveInventorySupplierResponse = SaveInventorySupplierMutation

const mutation1: TypedDocumentNode<
    MutateSaveInventorySupplierResponse,
    InputVariables<MutateSaveInventorySupplierRequest>
> = gql`
    mutation SaveInventorySupplier($input: SaveInventorySupplierInput!) {
        saveInventorySupplier(input: $input) {
            id
        }
    }
`

enum MutationSaveInventorySupplier {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveInventorySupplier,
    TypedDocumentNode<MutateSaveInventorySupplierResponse, InputVariables<MutateSaveInventorySupplierRequest>>
> = {
    [MutationSaveInventorySupplier.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveInventorySupplier}. */
type MutateSaveInventorySupplierParams = MutateParams<MutationSaveInventorySupplier, MutateSaveInventorySupplierRequest>

/** Runs the `saveInventorySupplier` mutation. */
export const mutateSaveInventorySupplier = async ({
    mutation = MutationSaveInventorySupplier.Mutation1,
    request,
    signal,
}: MutateSaveInventorySupplierParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
