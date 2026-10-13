import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationTakeInventoryStockArgs } from "../__generated__/schema"

/** The input of the `takeInventoryStock` mutation. */
export type MutateTakeInventoryStockRequest = MutationTakeInventoryStockArgs["input"]

/** The response of the `takeInventoryStock` mutation. */
type MutateTakeInventoryStockResponse = Pick<Mutation, "takeInventoryStock">

const mutation1: TypedDocumentNode<
    MutateTakeInventoryStockResponse,
    InputVariables<MutateTakeInventoryStockRequest>
> = gql`
    mutation TakeInventoryStock($input: TakeInventoryStockInput!) {
        takeInventoryStock(input: $input) {
            applied
            same
            waiting
        }
    }
`

enum MutationTakeInventoryStock {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationTakeInventoryStock,
    TypedDocumentNode<MutateTakeInventoryStockResponse, InputVariables<MutateTakeInventoryStockRequest>>
> = {
    [MutationTakeInventoryStock.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateTakeInventoryStock}. */
type MutateTakeInventoryStockParams = MutateParams<MutationTakeInventoryStock, MutateTakeInventoryStockRequest>

/** Runs the `takeInventoryStock` mutation. */
export const mutateTakeInventoryStock = async ({
    mutation = MutationTakeInventoryStock.Mutation1,
    request,
    signal,
}: MutateTakeInventoryStockParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
