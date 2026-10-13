import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDisconnectConnectionArgs } from "../__generated__/schema"

/** The input of the `disconnectConnection` mutation. */
export type MutateDisconnectConnectionRequest = MutationDisconnectConnectionArgs["input"]

/** The response of the `disconnectConnection` mutation. */
type MutateDisconnectConnectionResponse = Pick<Mutation, "disconnectConnection">

const mutation1: TypedDocumentNode<
    MutateDisconnectConnectionResponse,
    InputVariables<MutateDisconnectConnectionRequest>
> = gql`
    mutation DisconnectConnection($input: DisconnectConnectionInput!) {
        disconnectConnection(input: $input)
    }
`

enum MutationDisconnectConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDisconnectConnection,
    TypedDocumentNode<MutateDisconnectConnectionResponse, InputVariables<MutateDisconnectConnectionRequest>>
> = {
    [MutationDisconnectConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDisconnectConnection}. */
type MutateDisconnectConnectionParams = MutateParams<MutationDisconnectConnection, MutateDisconnectConnectionRequest>

/** Disconnects a connection without removing it. */
export const mutateDisconnectConnection = async ({
    mutation = MutationDisconnectConnection.Mutation1,
    request,
    signal,
}: MutateDisconnectConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
