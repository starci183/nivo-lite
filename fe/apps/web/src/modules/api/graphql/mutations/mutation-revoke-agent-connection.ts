import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RevokeAgentConnectionMutation, RevokeAgentConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `revokeAgentConnection` mutation. */
export type MutateRevokeAgentConnectionRequest = WireInput<RevokeAgentConnectionMutationVariables["input"]>

type MutateRevokeAgentConnectionResponse = RevokeAgentConnectionMutation

const mutation1: TypedDocumentNode<
    MutateRevokeAgentConnectionResponse,
    InputVariables<MutateRevokeAgentConnectionRequest>
> = gql`
    mutation RevokeAgentConnection($input: RevokeAgentConnectionInput!) {
        revokeAgentConnection(input: $input) {
            ok
        }
    }
`

enum MutationRevokeAgentConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRevokeAgentConnection,
    TypedDocumentNode<MutateRevokeAgentConnectionResponse, InputVariables<MutateRevokeAgentConnectionRequest>>
> = {
    [MutationRevokeAgentConnection.Mutation1]: mutation1,
}

/** The back end `revokeAgentConnection` mutation. */
export const mutateRevokeAgentConnection = async ({
    mutation = MutationRevokeAgentConnection.Mutation1,
    request,
    signal,
}: MutateParams<MutationRevokeAgentConnection, MutateRevokeAgentConnectionRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
