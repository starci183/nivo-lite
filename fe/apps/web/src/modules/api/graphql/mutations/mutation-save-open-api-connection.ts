import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveOpenApiConnectionArgs } from "../__generated__/schema"

/** The input of the `saveOpenApiConnection` mutation. */
export type MutateSaveOpenApiConnectionRequest = MutationSaveOpenApiConnectionArgs["input"]

/** The response of the `saveOpenApiConnection` mutation: the connection id. */
type MutateSaveOpenApiConnectionResponse = Pick<Mutation, "saveOpenApiConnection">

const mutation1: TypedDocumentNode<
    MutateSaveOpenApiConnectionResponse,
    InputVariables<MutateSaveOpenApiConnectionRequest>
> = gql`
    mutation SaveOpenApiConnection($input: SaveOpenApiConnectionInput!) {
        saveOpenApiConnection(input: $input)
    }
`

enum MutationSaveOpenApiConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveOpenApiConnection,
    TypedDocumentNode<MutateSaveOpenApiConnectionResponse, InputVariables<MutateSaveOpenApiConnectionRequest>>
> = {
    [MutationSaveOpenApiConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveOpenApiConnection}. */
type MutateSaveOpenApiConnectionParams = MutateParams<MutationSaveOpenApiConnection, MutateSaveOpenApiConnectionRequest>

/** Creates or updates an API connection and answers its id. */
export const mutateSaveOpenApiConnection = async ({
    mutation = MutationSaveOpenApiConnection.Mutation1,
    request,
    signal,
}: MutateSaveOpenApiConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
