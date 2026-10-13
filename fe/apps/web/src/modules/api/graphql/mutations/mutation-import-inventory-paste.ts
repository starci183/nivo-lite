import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationImportInventoryPasteArgs } from "../__generated__/schema"

/** The input of the `importInventoryPaste` mutation. */
export type MutateImportInventoryPasteRequest = MutationImportInventoryPasteArgs["input"]

/** The response of the `importInventoryPaste` mutation. */
type MutateImportInventoryPasteResponse = Pick<Mutation, "importInventoryPaste">

const mutation1: TypedDocumentNode<
    MutateImportInventoryPasteResponse,
    InputVariables<MutateImportInventoryPasteRequest>
> = gql`
    mutation ImportInventoryPaste($input: ImportInventoryPasteInput!) {
        importInventoryPaste(input: $input) {
            created
            skipped
            stocked
            updated
        }
    }
`

enum MutationImportInventoryPaste {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationImportInventoryPaste,
    TypedDocumentNode<MutateImportInventoryPasteResponse, InputVariables<MutateImportInventoryPasteRequest>>
> = {
    [MutationImportInventoryPaste.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateImportInventoryPaste}. */
type MutateImportInventoryPasteParams = MutateParams<MutationImportInventoryPaste, MutateImportInventoryPasteRequest>

/** Runs the `importInventoryPaste` mutation. */
export const mutateImportInventoryPaste = async ({
    mutation = MutationImportInventoryPaste.Mutation1,
    request,
    signal,
}: MutateImportInventoryPasteParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
