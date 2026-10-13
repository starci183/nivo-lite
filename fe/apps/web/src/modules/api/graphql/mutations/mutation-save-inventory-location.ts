import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveInventoryLocationArgs } from "../__generated__/schema"

/** The input of the `saveInventoryLocation` mutation. */
export type MutateSaveInventoryLocationRequest = MutationSaveInventoryLocationArgs["input"]

/** The response of the `saveInventoryLocation` mutation. */
type MutateSaveInventoryLocationResponse = Pick<Mutation, "saveInventoryLocation">

const mutation1: TypedDocumentNode<
    MutateSaveInventoryLocationResponse,
    InputVariables<MutateSaveInventoryLocationRequest>
> = gql`
    mutation SaveInventoryLocation($input: SaveInventoryLocationInput!) {
        saveInventoryLocation(input: $input)
    }
`

enum MutationSaveInventoryLocation {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveInventoryLocation,
    TypedDocumentNode<MutateSaveInventoryLocationResponse, InputVariables<MutateSaveInventoryLocationRequest>>
> = {
    [MutationSaveInventoryLocation.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveInventoryLocation}. */
type MutateSaveInventoryLocationParams = MutateParams<MutationSaveInventoryLocation, MutateSaveInventoryLocationRequest>

/** Runs the `saveInventoryLocation` mutation. */
export const mutateSaveInventoryLocation = async ({
    mutation = MutationSaveInventoryLocation.Mutation1,
    request,
    signal,
}: MutateSaveInventoryLocationParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
