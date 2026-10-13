import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationTransferInventoryStockArgs } from "../__generated__/schema"

/** The input of the `transferInventoryStock` mutation. */
export type MutateTransferInventoryStockRequest = MutationTransferInventoryStockArgs["input"]

/** The response of the `transferInventoryStock` mutation. */
type MutateTransferInventoryStockResponse = Pick<Mutation, "transferInventoryStock">

const mutation1: TypedDocumentNode<
    MutateTransferInventoryStockResponse,
    InputVariables<MutateTransferInventoryStockRequest>
> = gql`
    mutation TransferInventoryStock($input: TransferInventoryStockInput!) {
        transferInventoryStock(input: $input) {
            from
            to
        }
    }
`

enum MutationTransferInventoryStock {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationTransferInventoryStock,
    TypedDocumentNode<MutateTransferInventoryStockResponse, InputVariables<MutateTransferInventoryStockRequest>>
> = {
    [MutationTransferInventoryStock.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateTransferInventoryStock}. */
type MutateTransferInventoryStockParams = MutateParams<
    MutationTransferInventoryStock,
    MutateTransferInventoryStockRequest
>

/** Runs the `transferInventoryStock` mutation. */
export const mutateTransferInventoryStock = async ({
    mutation = MutationTransferInventoryStock.Mutation1,
    request,
    signal,
}: MutateTransferInventoryStockParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
