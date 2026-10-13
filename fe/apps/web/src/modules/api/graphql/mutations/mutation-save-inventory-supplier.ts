import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveInventorySupplierArgs } from "../__generated__/schema"

/** The input of the `saveInventorySupplier` mutation. */
export type MutateSaveInventorySupplierRequest = MutationSaveInventorySupplierArgs["input"]

/** The response of the `saveInventorySupplier` mutation. */
type MutateSaveInventorySupplierResponse = Pick<Mutation, "saveInventorySupplier">

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
