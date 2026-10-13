import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRedeemLoyaltyRewardRequest, MutateRedeemLoyaltyRewardResponse } from "./types/redeem-loyalty-reward"

const mutation1 = gql`
    mutation RedeemLoyaltyReward($input: RedeemLoyaltyRewardInput!) {
        redeemLoyaltyReward(input: $input) {
            code posted
        }
    }
`

export enum MutationRedeemLoyaltyReward {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRedeemLoyaltyReward, DocumentNode> = {
    [MutationRedeemLoyaltyReward.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRedeemLoyaltyReward}. */
export type MutationRedeemLoyaltyRewardParams = MutateParams<MutationRedeemLoyaltyReward, MutateRedeemLoyaltyRewardRequest>

/** Redeems a reward for a member; answers the redemption code the customer shows. */
export const mutateRedeemLoyaltyReward = async ({ mutation = MutationRedeemLoyaltyReward.Mutation1, request, signal }: MutationRedeemLoyaltyRewardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateRedeemLoyaltyRewardResponse, InputVariables<MutateRedeemLoyaltyRewardRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
