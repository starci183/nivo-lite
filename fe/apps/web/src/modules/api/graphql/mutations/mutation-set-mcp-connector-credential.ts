import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    SetMcpConnectorCredentialMutation,
    SetMcpConnectorCredentialMutationVariables,
} from "../__generated__/graphql"

/** The input of the `setMcpConnectorCredential` mutation. */
export type MutateSetMcpConnectorCredentialRequest = WireInput<SetMcpConnectorCredentialMutationVariables["input"]>

type MutateSetMcpConnectorCredentialResponse = SetMcpConnectorCredentialMutation

const mutation1: TypedDocumentNode<
    MutateSetMcpConnectorCredentialResponse,
    InputVariables<MutateSetMcpConnectorCredentialRequest>
> = gql`
    mutation SetMcpConnectorCredential($input: SetMcpConnectorCredentialInput!) {
        setMcpConnectorCredential(input: $input)
    }
`

enum MutationSetMcpConnectorCredential {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetMcpConnectorCredential,
    TypedDocumentNode<MutateSetMcpConnectorCredentialResponse, InputVariables<MutateSetMcpConnectorCredentialRequest>>
> = {
    [MutationSetMcpConnectorCredential.Mutation1]: mutation1,
}

/**
 * The back end `setMcpConnectorCredential` mutation: sets or rotates the sealed credential of a remote connector; answers the tool
 * count read with it. Rejects with the back end failure.
 */
export const mutateSetMcpConnectorCredential = async ({
    mutation = MutationSetMcpConnectorCredential.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetMcpConnectorCredential, MutateSetMcpConnectorCredentialRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
