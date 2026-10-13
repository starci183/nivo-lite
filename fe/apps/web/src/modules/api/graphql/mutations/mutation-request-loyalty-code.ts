import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateRequestLoyaltyCodeRequest, MutateRequestLoyaltyCodeResponse } from "./types/request-loyalty-code"

const mutation1 = gql`
    mutation RequestLoyaltyCode($input: RequestLoyaltyCodeInput!) {
        requestLoyaltyCode(input: $input) {
            code
        }
    }
`

export enum MutationRequestLoyaltyCode {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestLoyaltyCode, DocumentNode> = {
    [MutationRequestLoyaltyCode.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestLoyaltyCode}. */
export type MutationRequestLoyaltyCodeParams = MutateParams<MutationRequestLoyaltyCode, MutateRequestLoyaltyCodeRequest>

/** Asks the back end to send the verification code to the customer's own chat. */
export const mutateRequestLoyaltyCode = async ({ mutation = MutationRequestLoyaltyCode.Mutation1, request, signal }: MutationRequestLoyaltyCodeParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate<MutateRequestLoyaltyCodeResponse, InputVariables<MutateRequestLoyaltyCodeRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
