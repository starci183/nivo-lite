import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateSaveLoyaltyRewardRequest, MutateSaveLoyaltyRewardResponse } from "./types/save-loyalty-reward"

const mutation1 = gql`
    mutation SaveLoyaltyReward($input: SaveLoyaltyRewardInput!) {
        saveLoyaltyReward(input: $input) {
            active id key kind minTierKey name note perCustomerLimit percent pointsCost stock valueVnd
        }
    }
`

export enum MutationSaveLoyaltyReward {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveLoyaltyReward, DocumentNode> = {
    [MutationSaveLoyaltyReward.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveLoyaltyReward}. */
export type MutationSaveLoyaltyRewardParams = MutateParams<MutationSaveLoyaltyReward, MutateSaveLoyaltyRewardRequest>

/** Creates or updates one reward of the catalogue (id null creates). */
export const mutateSaveLoyaltyReward = async ({ mutation = MutationSaveLoyaltyReward.Mutation1, request, signal }: MutationSaveLoyaltyRewardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateSaveLoyaltyRewardResponse, InputVariables<MutateSaveLoyaltyRewardRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
