import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetChatTypingMutation, SetChatTypingMutationVariables } from "../__generated__/graphql"

/** The input of the `setChatTyping` mutation. */
export type MutateSetChatTypingRequest = WireInput<SetChatTypingMutationVariables["input"]>

type MutateSetChatTypingResponse = SetChatTypingMutation

const mutation1: TypedDocumentNode<MutateSetChatTypingResponse, InputVariables<MutateSetChatTypingRequest>> = gql`
    mutation SetChatTyping($input: SetChatTypingInput!) {
        setChatTyping(input: $input) {
            avatarSeed
            expiresAt
            id
            name
            typing
        }
    }
`

enum MutationSetChatTyping {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetChatTyping,
    TypedDocumentNode<MutateSetChatTypingResponse, InputVariables<MutateSetChatTypingRequest>>
> = {
    [MutationSetChatTyping.Mutation1]: mutation1,
}

/** The back end `setChatTyping` mutation. */
export const mutateSetChatTyping = async ({
    mutation = MutationSetChatTyping.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetChatTyping, MutateSetChatTypingRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
