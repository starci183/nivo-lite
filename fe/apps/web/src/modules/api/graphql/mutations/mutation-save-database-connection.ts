import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveDatabaseConnectionArgs } from "../__generated__/schema"

/** The input of the `saveDatabaseConnection` mutation. */
export type MutateSaveDatabaseConnectionRequest = MutationSaveDatabaseConnectionArgs["input"]

/** The response of the `saveDatabaseConnection` mutation. */
type MutateSaveDatabaseConnectionResponse = Pick<Mutation, "saveDatabaseConnection">

const mutation1: TypedDocumentNode<
    MutateSaveDatabaseConnectionResponse,
    InputVariables<MutateSaveDatabaseConnectionRequest>
> = gql`
    mutation SaveDatabaseConnection($input: SaveDatabaseConnectionInput!) {
        saveDatabaseConnection(input: $input)
    }
`

enum MutationSaveDatabaseConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveDatabaseConnection,
    TypedDocumentNode<MutateSaveDatabaseConnectionResponse, InputVariables<MutateSaveDatabaseConnectionRequest>>
> = {
    [MutationSaveDatabaseConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveDatabaseConnection}. */
type MutateSaveDatabaseConnectionParams = MutateParams<
    MutationSaveDatabaseConnection,
    MutateSaveDatabaseConnectionRequest
>

/** Creates or updates a database connection; answers its id. */
export const mutateSaveDatabaseConnection = async ({
    mutation = MutationSaveDatabaseConnection.Mutation1,
    request,
    signal,
}: MutateSaveDatabaseConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
