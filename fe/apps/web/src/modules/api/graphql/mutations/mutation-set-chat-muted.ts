import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetChatMutedMutation, SetChatMutedMutationVariables } from "../__generated__/graphql"

/** The input of the `setChatMuted` mutation. */
export type MutateSetChatMutedRequest = WireInput<SetChatMutedMutationVariables["input"]>

type MutateSetChatMutedResponse = SetChatMutedMutation

const mutation1: TypedDocumentNode<MutateSetChatMutedResponse, InputVariables<MutateSetChatMutedRequest>> = gql`
    mutation SetChatMuted($input: ChatMuteInput!) {
        setChatMuted(input: $input) {
            ok
        }
    }
`

enum MutationSetChatMuted {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetChatMuted,
    TypedDocumentNode<MutateSetChatMutedResponse, InputVariables<MutateSetChatMutedRequest>>
> = {
    [MutationSetChatMuted.Mutation1]: mutation1,
}

/** The back end `setChatMuted` mutation. */
export const mutateSetChatMuted = async ({
    mutation = MutationSetChatMuted.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetChatMuted, MutateSetChatMutedRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
