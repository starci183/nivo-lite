import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationCreateInventoryPoArgs } from "../__generated__/schema"

/** The input of the `createInventoryPo` mutation. */
export type MutateCreateInventoryPoRequest = MutationCreateInventoryPoArgs["input"]

/** The response of the `createInventoryPo` mutation. */
type MutateCreateInventoryPoResponse = Pick<Mutation, "createInventoryPo">

const mutation1: TypedDocumentNode<
    MutateCreateInventoryPoResponse,
    InputVariables<MutateCreateInventoryPoRequest>
> = gql`
    mutation CreateInventoryPo($input: CreateInventoryPoInput!) {
        createInventoryPo(input: $input) {
            id
        }
    }
`

enum MutationCreateInventoryPo {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCreateInventoryPo,
    TypedDocumentNode<MutateCreateInventoryPoResponse, InputVariables<MutateCreateInventoryPoRequest>>
> = {
    [MutationCreateInventoryPo.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateCreateInventoryPo}. */
type MutateCreateInventoryPoParams = MutateParams<MutationCreateInventoryPo, MutateCreateInventoryPoRequest>

/** Runs the `createInventoryPo` mutation. */
export const mutateCreateInventoryPo = async ({
    mutation = MutationCreateInventoryPo.Mutation1,
    request,
    signal,
}: MutateCreateInventoryPoParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
