import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationConnectTelegramArgs } from "../__generated__/schema"

/** The input of the `connectTelegram` mutation. */
export type MutateConnectTelegramRequest = MutationConnectTelegramArgs["input"]

/** The response of the `connectTelegram` mutation. */
type MutateConnectTelegramResponse = Pick<Mutation, "connectTelegram">

const mutation1: TypedDocumentNode<MutateConnectTelegramResponse, InputVariables<MutateConnectTelegramRequest>> = gql`
    mutation ConnectTelegram($input: ConnectTelegramInput!) {
        connectTelegram(input: $input) {
            webhookRegistered
            connection {
                id
            }
        }
    }
`

enum MutationConnectTelegram {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationConnectTelegram,
    TypedDocumentNode<MutateConnectTelegramResponse, InputVariables<MutateConnectTelegramRequest>>
> = {
    [MutationConnectTelegram.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateConnectTelegram}. */
type MutateConnectTelegramParams = MutateParams<MutationConnectTelegram, MutateConnectTelegramRequest>

/** Connects a Telegram bot from its token. */
export const mutateConnectTelegram = async ({
    mutation = MutationConnectTelegram.Mutation1,
    request,
    signal,
}: MutateConnectTelegramParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
