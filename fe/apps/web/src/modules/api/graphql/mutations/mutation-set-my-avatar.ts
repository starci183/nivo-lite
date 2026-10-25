import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SetMyAvatarMutation, SetMyAvatarMutationVariables } from "../__generated__/graphql"

/** The input of the `setMyAvatar` mutation. */
export type MutateSetMyAvatarRequest = WireInput<SetMyAvatarMutationVariables["input"]>

type MutateSetMyAvatarResponse = SetMyAvatarMutation

const mutation1: TypedDocumentNode<MutateSetMyAvatarResponse, InputVariables<MutateSetMyAvatarRequest>> = gql`
    mutation SetMyAvatar($input: SetMyAvatarInput!) {
        setMyAvatar(input: $input)
    }
`

enum MutationSetMyAvatar {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSetMyAvatar,
    TypedDocumentNode<MutateSetMyAvatarResponse, InputVariables<MutateSetMyAvatarRequest>>
> = {
    [MutationSetMyAvatar.Mutation1]: mutation1,
}

/** The back end `setMyAvatar` mutation: keeps the uploaded picture on the caller's account, or removes it with a null path. */
export const mutateSetMyAvatar = async ({
    mutation = MutationSetMyAvatar.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetMyAvatar, MutateSetMyAvatarRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
