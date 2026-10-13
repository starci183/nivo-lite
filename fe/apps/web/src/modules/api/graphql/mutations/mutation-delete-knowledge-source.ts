import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDeleteKnowledgeSourceArgs } from "../__generated__/schema"

/** The response of the `deleteKnowledgeSource` mutation: the typed payload straight from the back end contract. */
type MutateDeleteKnowledgeSourceResponse = Pick<Mutation, "deleteKnowledgeSource">

/** The input of the `deleteKnowledgeSource` mutation. */
export type MutateDeleteKnowledgeSourceRequest = MutationDeleteKnowledgeSourceArgs["input"]

const mutation1: TypedDocumentNode<
    MutateDeleteKnowledgeSourceResponse,
    InputVariables<MutateDeleteKnowledgeSourceRequest>
> = gql`
    mutation DeleteKnowledgeSource($input: DeleteKnowledgeSourceInput!) {
        deleteKnowledgeSource(input: $input)
    }
`

enum MutationDeleteKnowledgeSource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDeleteKnowledgeSource,
    TypedDocumentNode<MutateDeleteKnowledgeSourceResponse, InputVariables<MutateDeleteKnowledgeSourceRequest>>
> = {
    [MutationDeleteKnowledgeSource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeleteKnowledgeSource}. */
type MutateDeleteKnowledgeSourceParams = MutateParams<MutationDeleteKnowledgeSource, MutateDeleteKnowledgeSourceRequest>

/**
 * Deletes a document of the workspace with its passages (the back end `deleteKnowledgeSource` mutation). Rejects with
 * the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateDeleteKnowledgeSource = async ({
    mutation = MutationDeleteKnowledgeSource.Mutation1,
    request,
    signal,
}: MutateDeleteKnowledgeSourceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
