import type { UpdateLoyaltyMemberMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateUpdateLoyaltyMemberRequest } from "./types/update-loyalty-member"

const mutation1 = gql`
    mutation UpdateLoyaltyMember($input: UpdateLoyaltyMemberInput!) {
        updateLoyaltyMember(input: $input) {
            updated
        }
    }
`

enum MutationUpdateLoyaltyMember {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationUpdateLoyaltyMember, DocumentNode> = {
    [MutationUpdateLoyaltyMember.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdateLoyaltyMember}. */
type MutationUpdateLoyaltyMemberParams = MutateParams<MutationUpdateLoyaltyMember, MutateUpdateLoyaltyMemberRequest>

/** Edits the name, birthday and note of one member. */
export const mutateUpdateLoyaltyMember = async ({
    mutation = MutationUpdateLoyaltyMember.Mutation1,
    request,
    signal,
}: MutationUpdateLoyaltyMemberParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<UpdateLoyaltyMemberMutation, InputVariables<MutateUpdateLoyaltyMemberRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
