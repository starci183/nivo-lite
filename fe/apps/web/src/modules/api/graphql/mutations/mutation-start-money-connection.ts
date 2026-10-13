import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationStartMoneyConnectionArgs } from "../__generated__/schema"

/** The input of the `startMoneyConnection` mutation. */
export type MutateStartMoneyConnectionRequest = MutationStartMoneyConnectionArgs["input"]

/** The response of the `startMoneyConnection` mutation. */
type MutateStartMoneyConnectionResponse = Pick<Mutation, "startMoneyConnection">

const mutation1: TypedDocumentNode<
    MutateStartMoneyConnectionResponse,
    InputVariables<MutateStartMoneyConnectionRequest>
> = gql`
    mutation StartMoneyConnection($input: StartMoneyConnectionInput!) {
        startMoneyConnection(input: $input) {
            id
            provider
            name
            environment
            status
            webhookUrl
            apiKey
            bankCode
            account
            holder
            credentialsSaved
            firstEvent {
                amount
                at
                content
            }
            agentIds
        }
    }
`

enum MutationStartMoneyConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationStartMoneyConnection,
    TypedDocumentNode<MutateStartMoneyConnectionResponse, InputVariables<MutateStartMoneyConnectionRequest>>
> = {
    [MutationStartMoneyConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateStartMoneyConnection}. */
type MutateStartMoneyConnectionParams = MutateParams<MutationStartMoneyConnection, MutateStartMoneyConnectionRequest>

/** Creates a bank or payment connection. */
export const mutateStartMoneyConnection = async ({
    mutation = MutationStartMoneyConnection.Mutation1,
    request,
    signal,
}: MutateStartMoneyConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
