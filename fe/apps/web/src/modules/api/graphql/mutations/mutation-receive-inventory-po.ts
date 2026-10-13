import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationReceiveInventoryPoArgs } from "../__generated__/schema"

/** The input of the `receiveInventoryPo` mutation. */
export type MutateReceiveInventoryPoRequest = MutationReceiveInventoryPoArgs["input"]

/** The response of the `receiveInventoryPo` mutation. */
type MutateReceiveInventoryPoResponse = Pick<Mutation, "receiveInventoryPo">

const mutation1: TypedDocumentNode<
    MutateReceiveInventoryPoResponse,
    InputVariables<MutateReceiveInventoryPoRequest>
> = gql`
    mutation ReceiveInventoryPo($input: ReceiveInventoryPoInput!) {
        receiveInventoryPo(input: $input) {
            handedToAccounting
            payableVnd
            priceChanges
            received
            status
        }
    }
`

enum MutationReceiveInventoryPo {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationReceiveInventoryPo,
    TypedDocumentNode<MutateReceiveInventoryPoResponse, InputVariables<MutateReceiveInventoryPoRequest>>
> = {
    [MutationReceiveInventoryPo.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateReceiveInventoryPo}. */
type MutateReceiveInventoryPoParams = MutateParams<MutationReceiveInventoryPo, MutateReceiveInventoryPoRequest>

/** Runs the `receiveInventoryPo` mutation. */
export const mutateReceiveInventoryPo = async ({
    mutation = MutationReceiveInventoryPo.Mutation1,
    request,
    signal,
}: MutateReceiveInventoryPoParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
