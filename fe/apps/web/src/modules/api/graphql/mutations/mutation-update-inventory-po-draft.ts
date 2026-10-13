import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { UpdateInventoryPoDraftMutation, UpdateInventoryPoDraftMutationVariables } from "../__generated__/graphql"

/** The input of the `updateInventoryPoDraft` mutation. */
export type MutateUpdateInventoryPoDraftRequest = WireInput<UpdateInventoryPoDraftMutationVariables["input"]>

/** The response of the `updateInventoryPoDraft` mutation. */
type MutateUpdateInventoryPoDraftResponse = UpdateInventoryPoDraftMutation

const mutation1: TypedDocumentNode<
    MutateUpdateInventoryPoDraftResponse,
    InputVariables<MutateUpdateInventoryPoDraftRequest>
> = gql`
    mutation UpdateInventoryPoDraft($input: UpdateInventoryPoDraftInput!) {
        updateInventoryPoDraft(input: $input)
    }
`

enum MutationUpdateInventoryPoDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationUpdateInventoryPoDraft,
    TypedDocumentNode<MutateUpdateInventoryPoDraftResponse, InputVariables<MutateUpdateInventoryPoDraftRequest>>
> = {
    [MutationUpdateInventoryPoDraft.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdateInventoryPoDraft}. */
type MutateUpdateInventoryPoDraftParams = MutateParams<
    MutationUpdateInventoryPoDraft,
    MutateUpdateInventoryPoDraftRequest
>

/** Runs the `updateInventoryPoDraft` mutation. */
export const mutateUpdateInventoryPoDraft = async ({
    mutation = MutationUpdateInventoryPoDraft.Mutation1,
    request,
    signal,
}: MutateUpdateInventoryPoDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
