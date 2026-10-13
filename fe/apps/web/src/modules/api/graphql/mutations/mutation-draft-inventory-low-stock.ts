import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { MutateParams } from "../types"
import type { DraftInventoryLowStockMutation } from "../__generated__/graphql"

/** The response of the `draftInventoryLowStock` mutation. */
type MutateDraftInventoryLowStockResponse = DraftInventoryLowStockMutation

const mutation1: TypedDocumentNode<MutateDraftInventoryLowStockResponse> = gql`
    mutation DraftInventoryLowStock {
        draftInventoryLowStock {
            drafted
            low
        }
    }
`

enum MutationDraftInventoryLowStock {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationDraftInventoryLowStock, TypedDocumentNode<MutateDraftInventoryLowStockResponse>> = {
    [MutationDraftInventoryLowStock.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDraftInventoryLowStock}. */
type MutateDraftInventoryLowStockParams = Omit<MutateParams<MutationDraftInventoryLowStock, undefined>, "request"> & {
    request?: undefined
}

/** Runs the `draftInventoryLowStock` mutation. */
export const mutateDraftInventoryLowStock = async ({
    mutation = MutationDraftInventoryLowStock.Mutation1,
    signal,
}: MutateDraftInventoryLowStockParams = {}) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation] })
}
