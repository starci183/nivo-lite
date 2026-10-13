import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { MutateAddLoyaltyPresetRewardsResponse } from "./types/add-loyalty-preset-rewards"

const mutation1 = gql`
    mutation AddLoyaltyPresetRewards {
        addLoyaltyPresetRewards {
            added
        }
    }
`

export enum MutationAddLoyaltyPresetRewards {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAddLoyaltyPresetRewards, DocumentNode> = {
    [MutationAddLoyaltyPresetRewards.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAddLoyaltyPresetRewards}. */
export type MutationAddLoyaltyPresetRewardsParams = Omit<MutateParams<MutationAddLoyaltyPresetRewards, undefined>, "request">

/** Starts the reward catalogue from the built-in presets (no input). */
export const mutateAddLoyaltyPresetRewards = async ({ mutation = MutationAddLoyaltyPresetRewards.Mutation1, signal }: MutationAddLoyaltyPresetRewardsParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateAddLoyaltyPresetRewardsResponse>({ mutation: mutationMap[mutation] })
}
