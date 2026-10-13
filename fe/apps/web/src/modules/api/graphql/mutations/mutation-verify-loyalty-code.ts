import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateVerifyLoyaltyCodeRequest, MutateVerifyLoyaltyCodeResponse } from "./types/verify-loyalty-code"

const mutation1 = gql`
    mutation VerifyLoyaltyCode($input: VerifyLoyaltyCodeInput!) {
        verifyLoyaltyCode(input: $input) {
            code
            points { expiring { firstAt points } name nextTier { missingVnd tier { benefit key minSpendVnd multiplier name winbackDays } } points rewards { canRedeem name note pointsCost } shop tierName }
        }
    }
`

export enum MutationVerifyLoyaltyCode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationVerifyLoyaltyCode, DocumentNode> = {
    [MutationVerifyLoyaltyCode.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateVerifyLoyaltyCode}. */
export type MutationVerifyLoyaltyCodeParams = MutateParams<MutationVerifyLoyaltyCode, MutateVerifyLoyaltyCodeRequest>

/** Verifies the typed code and unlocks the customer's points and rewards. */
export const mutateVerifyLoyaltyCode = async ({ mutation = MutationVerifyLoyaltyCode.Mutation1, request, signal }: MutationVerifyLoyaltyCodeParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate<MutateVerifyLoyaltyCodeResponse, InputVariables<MutateVerifyLoyaltyCodeRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
