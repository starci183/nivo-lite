import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationReindexKnowledgeSourceArgs } from "../__generated__/schema"

/** The response of the `reindexKnowledgeSource` mutation: the typed payload straight from the back end contract. */
type MutateReindexKnowledgeSourceResponse = Pick<Mutation, "reindexKnowledgeSource">

/** The input of the `reindexKnowledgeSource` mutation. */
export type MutateReindexKnowledgeSourceRequest = MutationReindexKnowledgeSourceArgs["input"]

const mutation1: TypedDocumentNode<
    MutateReindexKnowledgeSourceResponse,
    InputVariables<MutateReindexKnowledgeSourceRequest>
> = gql`
    mutation ReindexKnowledgeSource($input: ReindexKnowledgeSourceInput!) {
        reindexKnowledgeSource(input: $input) {
            id
        }
    }
`

enum MutationReindexKnowledgeSource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationReindexKnowledgeSource,
    TypedDocumentNode<MutateReindexKnowledgeSourceResponse, InputVariables<MutateReindexKnowledgeSourceRequest>>
> = {
    [MutationReindexKnowledgeSource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateReindexKnowledgeSource}. */
type MutateReindexKnowledgeSourceParams = MutateParams<
    MutationReindexKnowledgeSource,
    MutateReindexKnowledgeSourceRequest
>

/**
 * Reads a document again and indexes it from scratch (the back end `reindexKnowledgeSource` mutation). Rejects with the
 * back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateReindexKnowledgeSource = async ({
    mutation = MutationReindexKnowledgeSource.Mutation1,
    request,
    signal,
}: MutateReindexKnowledgeSourceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
