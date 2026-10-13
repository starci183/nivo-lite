import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationApplyInventoryStarterArgs } from "../__generated__/schema"

/** The input of the `applyInventoryStarter` mutation. */
export type MutateApplyInventoryStarterRequest = MutationApplyInventoryStarterArgs["input"]

/** The response of the `applyInventoryStarter` mutation. */
type MutateApplyInventoryStarterResponse = Pick<Mutation, "applyInventoryStarter">

const mutation1: TypedDocumentNode<
    MutateApplyInventoryStarterResponse,
    InputVariables<MutateApplyInventoryStarterRequest>
> = gql`
    mutation ApplyInventoryStarter($input: ApplyInventoryStarterInput!) {
        applyInventoryStarter(input: $input) {
            items
            recipes
            suppliers
        }
    }
`

enum MutationApplyInventoryStarter {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApplyInventoryStarter,
    TypedDocumentNode<MutateApplyInventoryStarterResponse, InputVariables<MutateApplyInventoryStarterRequest>>
> = {
    [MutationApplyInventoryStarter.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateApplyInventoryStarter}. */
type MutateApplyInventoryStarterParams = MutateParams<MutationApplyInventoryStarter, MutateApplyInventoryStarterRequest>

/** Runs the `applyInventoryStarter` mutation. */
export const mutateApplyInventoryStarter = async ({
    mutation = MutationApplyInventoryStarter.Mutation1,
    request,
    signal,
}: MutateApplyInventoryStarterParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
