import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { UpdateAuthorityMutation, UpdateAuthorityMutationVariables } from "../__generated__/graphql"

/** The input of the `updateAuthority` mutation. */
export type MutateUpdateAuthorityRequest = WireInput<UpdateAuthorityMutationVariables["input"]>

type MutateUpdateAuthorityResponse = UpdateAuthorityMutation

const mutation1: TypedDocumentNode<MutateUpdateAuthorityResponse, InputVariables<MutateUpdateAuthorityRequest>> = gql`
    mutation UpdateAuthority($input: UpdateAuthorityInput!) {
        updateAuthority(input: $input) {
            brand_voice
            goal_first_reply_minutes
            goal_new_customers
            goal_note
            goal_revenue_vnd
            limits_note
            policies
            reply_style
            updated_at
            updated_by
        }
    }
`

enum MutationUpdateAuthority {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationUpdateAuthority,
    TypedDocumentNode<MutateUpdateAuthorityResponse, InputVariables<MutateUpdateAuthorityRequest>>
> = {
    [MutationUpdateAuthority.Mutation1]: mutation1,
}

/** The back end `updateAuthority` mutation. */
export const mutateUpdateAuthority = async ({
    mutation = MutationUpdateAuthority.Mutation1,
    request,
    signal,
}: MutateParams<MutationUpdateAuthority, MutateUpdateAuthorityRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
