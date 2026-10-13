import type { VerifyLoyaltyCodeMutation } from "../__generated__/graphql"
import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateVerifyLoyaltyCodeRequest } from "./types/verify-loyalty-code"

const mutation1 = gql`
    mutation VerifyLoyaltyCode($input: VerifyLoyaltyCodeInput!) {
        verifyLoyaltyCode(input: $input) {
            code
            points {
                expiring {
                    firstAt
                    points
                }
                name
                nextTier {
                    missingVnd
                    tier {
                        benefit
                        key
                        minSpendVnd
                        multiplier
                        name
                        winbackDays
                    }
                }
                points
                rewards {
                    canRedeem
                    name
                    note
                    pointsCost
                }
                shop
                tierName
            }
        }
    }
`

enum MutationVerifyLoyaltyCode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationVerifyLoyaltyCode, DocumentNode> = {
    [MutationVerifyLoyaltyCode.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateVerifyLoyaltyCode}. */
type MutationVerifyLoyaltyCodeParams = MutateParams<MutationVerifyLoyaltyCode, MutateVerifyLoyaltyCodeRequest>

/** Verifies the typed code and unlocks the customer's points and rewards. */
export const mutateVerifyLoyaltyCode = async ({
    mutation = MutationVerifyLoyaltyCode.Mutation1,
    request,
    signal,
}: MutationVerifyLoyaltyCodeParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate<VerifyLoyaltyCodeMutation, InputVariables<MutateVerifyLoyaltyCodeRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
