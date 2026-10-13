import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationGrantAgentConnectionArgs } from "../__generated__/schema"

/** The input of the `grantAgentConnection` mutation. */
export type MutateGrantAgentConnectionRequest = MutationGrantAgentConnectionArgs["input"]

type MutateGrantAgentConnectionResponse = Pick<Mutation, "grantAgentConnection">

const mutation1: TypedDocumentNode<
    MutateGrantAgentConnectionResponse,
    InputVariables<MutateGrantAgentConnectionRequest>
> = gql`
    mutation GrantAgentConnection($input: GrantAgentConnectionInput!) {
        grantAgentConnection(input: $input) {
            ok
        }
    }
`

enum MutationGrantAgentConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationGrantAgentConnection,
    TypedDocumentNode<MutateGrantAgentConnectionResponse, InputVariables<MutateGrantAgentConnectionRequest>>
> = {
    [MutationGrantAgentConnection.Mutation1]: mutation1,
}

/** The back end `grantAgentConnection` mutation. */
export const mutateGrantAgentConnection = async ({
    mutation = MutationGrantAgentConnection.Mutation1,
    request,
    signal,
}: MutateParams<MutationGrantAgentConnection, MutateGrantAgentConnectionRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
