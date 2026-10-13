import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveImapConnectionMutation, SaveImapConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `saveImapConnection` mutation. */
export type MutateSaveImapConnectionRequest = WireInput<SaveImapConnectionMutationVariables["input"]>

/** The response of the `saveImapConnection` mutation. */
type MutateSaveImapConnectionResponse = SaveImapConnectionMutation

const mutation1: TypedDocumentNode<
    MutateSaveImapConnectionResponse,
    InputVariables<MutateSaveImapConnectionRequest>
> = gql`
    mutation SaveImapConnection($input: SaveImapConnectionInput!) {
        saveImapConnection(input: $input)
    }
`

enum MutationSaveImapConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveImapConnection,
    TypedDocumentNode<MutateSaveImapConnectionResponse, InputVariables<MutateSaveImapConnectionRequest>>
> = {
    [MutationSaveImapConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveImapConnection}. */
type MutateSaveImapConnectionParams = MutateParams<MutationSaveImapConnection, MutateSaveImapConnectionRequest>

/** Creates a mailbox connection or updates an existing one; answers its id. */
export const mutateSaveImapConnection = async ({
    mutation = MutationSaveImapConnection.Mutation1,
    request,
    signal,
}: MutateSaveImapConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
