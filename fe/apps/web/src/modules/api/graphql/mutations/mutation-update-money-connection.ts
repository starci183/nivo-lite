import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationUpdateMoneyConnectionArgs } from "../__generated__/schema"

/** The input of the `updateMoneyConnection` mutation. */
export type MutateUpdateMoneyConnectionRequest = MutationUpdateMoneyConnectionArgs["input"]

/** The response of the `updateMoneyConnection` mutation. */
type MutateUpdateMoneyConnectionResponse = Pick<Mutation, "updateMoneyConnection">

const mutation1: TypedDocumentNode<
    MutateUpdateMoneyConnectionResponse,
    InputVariables<MutateUpdateMoneyConnectionRequest>
> = gql`
    mutation UpdateMoneyConnection($input: UpdateMoneyConnectionInput!) {
        updateMoneyConnection(input: $input) {
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

enum MutationUpdateMoneyConnection {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationUpdateMoneyConnection,
    TypedDocumentNode<MutateUpdateMoneyConnectionResponse, InputVariables<MutateUpdateMoneyConnectionRequest>>
> = {
    [MutationUpdateMoneyConnection.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdateMoneyConnection}. */
type MutateUpdateMoneyConnectionParams = MutateParams<MutationUpdateMoneyConnection, MutateUpdateMoneyConnectionRequest>

/** Edits a bank or payment connection. */
export const mutateUpdateMoneyConnection = async ({
    mutation = MutationUpdateMoneyConnection.Mutation1,
    request,
    signal,
}: MutateUpdateMoneyConnectionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
