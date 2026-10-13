import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DisconnectConnectionMutation, DisconnectConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `disconnectConnection` mutation. */
type MutateDisconnectConnectionRequest = WireInput<DisconnectConnectionMutationVariables["input"]>

/** The response of the `disconnectConnection` mutation. */
type MutateDisconnectConnectionResponse = DisconnectConnectionMutation

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
