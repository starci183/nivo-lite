import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDecideExecutionArgs } from "../__generated__/schema"

/** The input of the `decideExecution` mutation. */
export type MutateDecideExecutionRequest = MutationDecideExecutionArgs["input"]

type MutateDecideExecutionResponse = Pick<Mutation, "decideExecution">

const mutation1: TypedDocumentNode<MutateDecideExecutionResponse, InputVariables<MutateDecideExecutionRequest>> = gql`
    mutation DecideExecution($input: DecideExecutionInput!) {
        decideExecution(input: $input) {
            draft
            id
            status
            work_item_id
        }
    }
`

enum MutationDecideExecution {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideExecution,
    TypedDocumentNode<MutateDecideExecutionResponse, InputVariables<MutateDecideExecutionRequest>>
> = {
    [MutationDecideExecution.Mutation1]: mutation1,
}

/** The back end `decideExecution` mutation. */
export const mutateDecideExecution = async ({
    mutation = MutationDecideExecution.Mutation1,
    request,
    signal,
}: MutateParams<MutationDecideExecution, MutateDecideExecutionRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
