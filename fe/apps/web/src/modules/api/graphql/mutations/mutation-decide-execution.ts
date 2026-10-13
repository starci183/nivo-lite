import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideExecutionMutation, DecideExecutionMutationVariables } from "../__generated__/graphql"

/** The input of the `decideExecution` mutation. */
export type MutateDecideExecutionRequest = WireInput<DecideExecutionMutationVariables["input"]>

type MutateDecideExecutionResponse = DecideExecutionMutation

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
