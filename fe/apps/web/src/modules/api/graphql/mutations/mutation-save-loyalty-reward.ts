import type { SaveLoyaltyRewardMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveLoyaltyRewardRequest } from "./types/save-loyalty-reward"

const mutation1 = gql`
    mutation SaveLoyaltyReward($input: SaveLoyaltyRewardInput!) {
        saveLoyaltyReward(input: $input) {
            active
            id
            key
            kind
            minTierKey
            name
            note
            perCustomerLimit
            percent
            pointsCost
            stock
            valueVnd
        }
    }
`

enum MutationSaveLoyaltyReward {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveLoyaltyReward, DocumentNode> = {
    [MutationSaveLoyaltyReward.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveLoyaltyReward}. */
type MutationSaveLoyaltyRewardParams = MutateParams<MutationSaveLoyaltyReward, MutateSaveLoyaltyRewardRequest>

/** Creates or updates one reward of the catalogue (id null creates). */
export const mutateSaveLoyaltyReward = async ({
    mutation = MutationSaveLoyaltyReward.Mutation1,
    request,
    signal,
}: MutationSaveLoyaltyRewardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<SaveLoyaltyRewardMutation, InputVariables<MutateSaveLoyaltyRewardRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
