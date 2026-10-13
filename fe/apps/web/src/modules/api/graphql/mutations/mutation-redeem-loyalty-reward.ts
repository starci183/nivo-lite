import type { RedeemLoyaltyRewardMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRedeemLoyaltyRewardRequest } from "./types/redeem-loyalty-reward"

const mutation1 = gql`
    mutation RedeemLoyaltyReward($input: RedeemLoyaltyRewardInput!) {
        redeemLoyaltyReward(input: $input) {
            code
            posted
        }
    }
`

enum MutationRedeemLoyaltyReward {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRedeemLoyaltyReward, DocumentNode> = {
    [MutationRedeemLoyaltyReward.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRedeemLoyaltyReward}. */
type MutationRedeemLoyaltyRewardParams = MutateParams<MutationRedeemLoyaltyReward, MutateRedeemLoyaltyRewardRequest>

/** Redeems a reward for a member; answers the redemption code the customer shows. */
export const mutateRedeemLoyaltyReward = async ({
    mutation = MutationRedeemLoyaltyReward.Mutation1,
    request,
    signal,
}: MutationRedeemLoyaltyRewardParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<RedeemLoyaltyRewardMutation, InputVariables<MutateRedeemLoyaltyRewardRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
