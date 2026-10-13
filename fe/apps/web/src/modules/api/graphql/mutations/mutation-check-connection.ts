import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { CheckConnectionMutation, CheckConnectionMutationVariables } from "../__generated__/graphql"

/** The input of the `checkConnection` mutation. */
export type MutateCheckConnectionRequest = WireInput<CheckConnectionMutationVariables["input"]>

/** The response of the `checkConnection` mutation. */
type MutateCheckConnectionResponse = CheckConnectionMutation

const mutation1: TypedDocumentNode<MutateCheckConnectionResponse, InputVariables<MutateCheckConnectionRequest>> = gql`
    mutation CheckConnection($input: CheckConnectionInput!) {
        checkConnection(input: $input) {
            provider
            webhookOk
            localOnly
            pending
            lastError
        }
    }
`

enum MutationCheckConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCheckConnection,
    TypedDocumentNode<MutateCheckConnectionResponse, InputVariables<MutateCheckConnectionRequest>>
> = {
    [MutationCheckConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCheckConnection}. */
type MutateCheckConnectionParams = MutateParams<MutationCheckConnection, MutateCheckConnectionRequest>

/** Asks the provider what it knows about a connection. */
export const mutateCheckConnection = async ({
    mutation = MutationCheckConnection.Mutation1,
    request,
    signal,
}: MutateCheckConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
