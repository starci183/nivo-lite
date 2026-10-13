import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDeleteConnectionArgs } from "../__generated__/schema"

/** The input of the `deleteConnection` mutation. */
export type MutateDeleteConnectionRequest = MutationDeleteConnectionArgs["input"]

/** The response of the `deleteConnection` mutation. */
type MutateDeleteConnectionResponse = Pick<Mutation, "deleteConnection">

const mutation1: TypedDocumentNode<MutateDeleteConnectionResponse, InputVariables<MutateDeleteConnectionRequest>> = gql`
    mutation DeleteConnection($input: DeleteConnectionInput!) {
        deleteConnection(input: $input)
    }
`

enum MutationDeleteConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDeleteConnection,
    TypedDocumentNode<MutateDeleteConnectionResponse, InputVariables<MutateDeleteConnectionRequest>>
> = {
    [MutationDeleteConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeleteConnection}. */
type MutateDeleteConnectionParams = MutateParams<MutationDeleteConnection, MutateDeleteConnectionRequest>

/** Removes a connection. */
export const mutateDeleteConnection = async ({
    mutation = MutationDeleteConnection.Mutation1,
    request,
    signal,
}: MutateDeleteConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
