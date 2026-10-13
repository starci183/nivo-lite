import { gql } from "@apollo/client"
import type { DocumentNode } from "graphql"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { MutateAdjustLoyaltyPointsRequest, MutateAdjustLoyaltyPointsResponse } from "./types/adjust-loyalty-points"

const mutation1 = gql`
    mutation AdjustLoyaltyPoints($input: AdjustLoyaltyPointsInput!) {
        adjustLoyaltyPoints(input: $input) {
            posted
        }
    }
`

export enum MutationAdjustLoyaltyPoints {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAdjustLoyaltyPoints, DocumentNode> = {
    [MutationAdjustLoyaltyPoints.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAdjustLoyaltyPoints}. */
export type MutationAdjustLoyaltyPointsParams = MutateParams<MutationAdjustLoyaltyPoints, MutateAdjustLoyaltyPointsRequest>

/** Adjusts the points of one member; posted says the ledger row was written right away. */
export const mutateAdjustLoyaltyPoints = async ({ mutation = MutationAdjustLoyaltyPoints.Mutation1, request, signal }: MutationAdjustLoyaltyPointsParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate<MutateAdjustLoyaltyPointsResponse, InputVariables<MutateAdjustLoyaltyPointsRequest>>({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
