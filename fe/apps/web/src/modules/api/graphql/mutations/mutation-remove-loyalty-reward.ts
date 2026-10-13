import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRemoveLoyaltyRewardRequest, MutateRemoveLoyaltyRewardResponse } from "./types/remove-loyalty-reward"

const mutation1 = gql`
    mutation RemoveLoyaltyReward($input: RemoveLoyaltyRewardInput!) {
        removeLoyaltyReward(input: $input) {
            deleted
        }
    }
`

export enum MutationRemoveLoyaltyReward {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRemoveLoyaltyReward, DocumentNode> = {
    [MutationRemoveLoyaltyReward.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveLoyaltyReward}. */
export type MutationRemoveLoyaltyRewardParams = MutateParams<MutationRemoveLoyaltyReward, MutateRemoveLoyaltyRewardRequest>

/** Removes one reward of the catalogue. */
export const mutateRemoveLoyaltyReward = async ({ mutation = MutationRemoveLoyaltyReward.Mutation1, request, signal }: MutationRemoveLoyaltyRewardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateRemoveLoyaltyRewardResponse, InputVariables<MutateRemoveLoyaltyRewardRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
