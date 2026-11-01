import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { UndoBrainFactBatchMutation, UndoBrainFactBatchMutationVariables } from "../__generated__/graphql"

/** The response of the `undoBrainFactBatch` mutation: the typed payload straight from the back end contract. */
type MutateUndoBrainFactBatchResponse = UndoBrainFactBatchMutation

/** The input of the `undoBrainFactBatch` mutation. */
export type MutateUndoBrainFactBatchRequest = WireInput<UndoBrainFactBatchMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateUndoBrainFactBatchResponse,
    InputVariables<MutateUndoBrainFactBatchRequest>
> = gql`
    mutation UndoBrainFactBatch($input: UndoBrainFactBatchInput!) {
        undoBrainFactBatch(input: $input) {
            kept
            restored
        }
    }
`

enum MutationUndoBrainFactBatch {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationUndoBrainFactBatch,
    TypedDocumentNode<MutateUndoBrainFactBatchResponse, InputVariables<MutateUndoBrainFactBatchRequest>>
> = {
    [MutationUndoBrainFactBatch.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUndoBrainFactBatch}. */
type MutateUndoBrainFactBatchParams = MutateParams<MutationUndoBrainFactBatch, MutateUndoBrainFactBatchRequest>

/**
 * Takes a batch of facts applied together back to review (the back end
 * `undoBrainFactBatch` mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateUndoBrainFactBatch = async ({
    mutation = MutationUndoBrainFactBatch.Mutation1,
    request,
    signal,
}: MutateUndoBrainFactBatchParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
