import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationEnqueueKnowledgeSourceArgs } from "../__generated__/schema"

/** The response of the `enqueueKnowledgeSource` mutation: the typed payload straight from the back end contract. */
type MutateEnqueueKnowledgeSourceResponse = Pick<Mutation, "enqueueKnowledgeSource">

/** The input of the `enqueueKnowledgeSource` mutation. */
export type MutateEnqueueKnowledgeSourceRequest = MutationEnqueueKnowledgeSourceArgs["input"]

const mutation1: TypedDocumentNode<
    MutateEnqueueKnowledgeSourceResponse,
    InputVariables<MutateEnqueueKnowledgeSourceRequest>
> = gql`
    mutation EnqueueKnowledgeSource($input: EnqueueKnowledgeSourceInput!) {
        enqueueKnowledgeSource(input: $input) {
            id
        }
    }
`

enum MutationEnqueueKnowledgeSource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationEnqueueKnowledgeSource,
    TypedDocumentNode<MutateEnqueueKnowledgeSourceResponse, InputVariables<MutateEnqueueKnowledgeSourceRequest>>
> = {
    [MutationEnqueueKnowledgeSource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateEnqueueKnowledgeSource}. */
type MutateEnqueueKnowledgeSourceParams = MutateParams<
    MutationEnqueueKnowledgeSource,
    MutateEnqueueKnowledgeSourceRequest
>

/**
 * Adds a document of the workspace (a note, a Q&A list, an uploaded file or a link) and queues its indexing (the back
 * end `enqueueKnowledgeSource` mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized
 * by the server).
 */
export const mutateEnqueueKnowledgeSource = async ({
    mutation = MutationEnqueueKnowledgeSource.Mutation1,
    request,
    signal,
}: MutateEnqueueKnowledgeSourceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
