import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { UpdateProfileMutation, UpdateProfileMutationVariables } from "../__generated__/graphql"

/** The input of the `updateProfile` mutation. */
type MutateUpdateProfileRequest = WireInput<UpdateProfileMutationVariables["input"]>

/** The response of the `updateProfile` mutation: the typed payload straight from the back end contract. */
type MutateUpdateProfileResponse = UpdateProfileMutation

type Document = TypedDocumentNode<MutateUpdateProfileResponse, InputVariables<MutateUpdateProfileRequest>>

const mutation1: Document = gql`
    mutation UpdateProfile($input: UpdateProfileInput!) {
        updateProfile(input: $input)
    }
`

enum MutationUpdateProfile {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUpdateProfile, Document> = {
    [MutationUpdateProfile.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdateProfile}. */
type MutateUpdateProfileParams = MutateParams<MutationUpdateProfile, MutateUpdateProfileRequest>

/** Saves the display name on the account and its memberships (the back end `updateProfile` mutation). */
export const mutateUpdateProfile = async ({
    mutation = MutationUpdateProfile.Mutation1,
    request,
    signal,
}: MutateUpdateProfileParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
