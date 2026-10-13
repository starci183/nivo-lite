import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AdjustInventoryStockMutation, AdjustInventoryStockMutationVariables } from "../__generated__/graphql"

/** The input of the `adjustInventoryStock` mutation. */
export type MutateAdjustInventoryStockRequest = WireInput<AdjustInventoryStockMutationVariables["input"]>

/** The response of the `adjustInventoryStock` mutation. */
type MutateAdjustInventoryStockResponse = AdjustInventoryStockMutation

const mutation1: TypedDocumentNode<
    MutateAdjustInventoryStockResponse,
    InputVariables<MutateAdjustInventoryStockRequest>
> = gql`
    mutation AdjustInventoryStock($input: AdjustInventoryStockInput!) {
        adjustInventoryStock(input: $input) {
            after
            before
            state
            workItemId
        }
    }
`

enum MutationAdjustInventoryStock {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAdjustInventoryStock,
    TypedDocumentNode<MutateAdjustInventoryStockResponse, InputVariables<MutateAdjustInventoryStockRequest>>
> = {
    [MutationAdjustInventoryStock.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAdjustInventoryStock}. */
type MutateAdjustInventoryStockParams = MutateParams<MutationAdjustInventoryStock, MutateAdjustInventoryStockRequest>

/** Runs the `adjustInventoryStock` mutation. */
export const mutateAdjustInventoryStock = async ({
    mutation = MutationAdjustInventoryStock.Mutation1,
    request,
    signal,
}: MutateAdjustInventoryStockParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
