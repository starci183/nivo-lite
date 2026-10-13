import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCancelInventoryPoArgs } from "../__generated__/schema"

/** The input of the `cancelInventoryPo` mutation. */
export type MutateCancelInventoryPoRequest = MutationCancelInventoryPoArgs["input"]

/** The response of the `cancelInventoryPo` mutation. */
type MutateCancelInventoryPoResponse = Pick<Mutation, "cancelInventoryPo">

const mutation1: TypedDocumentNode<
    MutateCancelInventoryPoResponse,
    InputVariables<MutateCancelInventoryPoRequest>
> = gql`
    mutation CancelInventoryPo($input: InventoryPoRefInput!) {
        cancelInventoryPo(input: $input)
    }
`

enum MutationCancelInventoryPo {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCancelInventoryPo,
    TypedDocumentNode<MutateCancelInventoryPoResponse, InputVariables<MutateCancelInventoryPoRequest>>
> = {
    [MutationCancelInventoryPo.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCancelInventoryPo}. */
type MutateCancelInventoryPoParams = MutateParams<MutationCancelInventoryPo, MutateCancelInventoryPoRequest>

/** Runs the `cancelInventoryPo` mutation. */
export const mutateCancelInventoryPo = async ({
    mutation = MutationCancelInventoryPo.Mutation1,
    request,
    signal,
}: MutateCancelInventoryPoParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
