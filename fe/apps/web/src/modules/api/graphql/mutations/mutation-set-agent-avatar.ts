import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetAgentAvatarMutation, SetAgentAvatarMutationVariables } from "../__generated__/graphql"

/** The input of the `setAgentAvatar` mutation. */
export type MutateSetAgentAvatarRequest = WireInput<SetAgentAvatarMutationVariables["input"]>

type MutateSetAgentAvatarResponse = SetAgentAvatarMutation

const mutation1: TypedDocumentNode<MutateSetAgentAvatarResponse, InputVariables<MutateSetAgentAvatarRequest>> = gql`
    mutation SetAgentAvatar($input: SetAgentAvatarInput!) {
        setAgentAvatar(input: $input) {
            ok
        }
    }
`

enum MutationSetAgentAvatar {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetAgentAvatar,
    TypedDocumentNode<MutateSetAgentAvatarResponse, InputVariables<MutateSetAgentAvatarRequest>>
> = {
    [MutationSetAgentAvatar.Mutation1]: mutation1,
}

/** The back end `setAgentAvatar` mutation: sets the uploaded picture on an agent, or removes it with a null path. */
export const mutateSetAgentAvatar = async ({
    mutation = MutationSetAgentAvatar.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetAgentAvatar, MutateSetAgentAvatarRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
