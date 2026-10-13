import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RetryKnowledgeSourceMutation, RetryKnowledgeSourceMutationVariables } from "../__generated__/graphql"

/** The response of the `retryKnowledgeSource` mutation: the typed payload straight from the back end contract. */
type MutateRetryKnowledgeSourceResponse = RetryKnowledgeSourceMutation

/** The input of the `retryKnowledgeSource` mutation. */
export type MutateRetryKnowledgeSourceRequest = WireInput<RetryKnowledgeSourceMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateRetryKnowledgeSourceResponse,
    InputVariables<MutateRetryKnowledgeSourceRequest>
> = gql`
    mutation RetryKnowledgeSource($input: RetryKnowledgeSourceInput!) {
        retryKnowledgeSource(input: $input) {
            id
        }
    }
`

enum MutationRetryKnowledgeSource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRetryKnowledgeSource,
    TypedDocumentNode<MutateRetryKnowledgeSourceResponse, InputVariables<MutateRetryKnowledgeSourceRequest>>
> = {
    [MutationRetryKnowledgeSource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRetryKnowledgeSource}. */
type MutateRetryKnowledgeSourceParams = MutateParams<MutationRetryKnowledgeSource, MutateRetryKnowledgeSourceRequest>

/**
 * Sends a failed document back to the job queue (the back end `retryKnowledgeSource` mutation). Rejects with the back
 * end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRetryKnowledgeSource = async ({
    mutation = MutationRetryKnowledgeSource.Mutation1,
    request,
    signal,
}: MutateRetryKnowledgeSourceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
