import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetChatRoomMutedMutation, SetChatRoomMutedMutationVariables } from "../__generated__/graphql"

/** Generated input of the SetChatRoomMuted mutation. */
type MutateSetChatRoomMutedRequest = WireInput<SetChatRoomMutedMutationVariables["input"]>

type MutateSetChatRoomMutedResponse = SetChatRoomMutedMutation

type Document = TypedDocumentNode<MutateSetChatRoomMutedResponse, InputVariables<MutateSetChatRoomMutedRequest>>

const mutation1: Document = gql`
    mutation SetChatRoomMuted($input: SetChatRoomMutedInput!) {
        setChatRoomMuted(input: $input) {
            room {
                id
                muted
            }
            refusal
        }
    }
`

enum MutationSetChatRoomMuted {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetChatRoomMuted, Document> = { [MutationSetChatRoomMuted.Mutation1]: mutation1 }

/** Parameters of the SetChatRoomMuted mutation. */
type MutateSetChatRoomMutedParams = MutateParams<MutationSetChatRoomMuted, MutateSetChatRoomMutedRequest>

/** Mutes or unmutes a room for the viewer: a muted room stays in the list and counts no unread in the badge. */
export const mutateSetChatRoomMuted = async ({
    mutation = MutationSetChatRoomMuted.Mutation1,
    request,
    signal,
    headers,
}: MutateSetChatRoomMutedParams): Promise<ApolloClient.MutateResult<MutateSetChatRoomMutedResponse>> => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
        context: { headers },
    })
}
