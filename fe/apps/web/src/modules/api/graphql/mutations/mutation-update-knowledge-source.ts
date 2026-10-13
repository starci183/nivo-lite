import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { UpdateKnowledgeSourceMutation, UpdateKnowledgeSourceMutationVariables } from "../__generated__/graphql"

/** The response of the `updateKnowledgeSource` mutation: the typed payload straight from the back end contract. */
type MutateUpdateKnowledgeSourceResponse = UpdateKnowledgeSourceMutation

/** The input of the `updateKnowledgeSource` mutation. */
export type MutateUpdateKnowledgeSourceRequest = WireInput<UpdateKnowledgeSourceMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateUpdateKnowledgeSourceResponse,
    InputVariables<MutateUpdateKnowledgeSourceRequest>
> = gql`
    mutation UpdateKnowledgeSource($input: UpdateKnowledgeSourceInput!) {
        updateKnowledgeSource(input: $input)
    }
`

enum MutationUpdateKnowledgeSource {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationUpdateKnowledgeSource,
    TypedDocumentNode<MutateUpdateKnowledgeSourceResponse, InputVariables<MutateUpdateKnowledgeSourceRequest>>
> = {
    [MutationUpdateKnowledgeSource.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdateKnowledgeSource}. */
type MutateUpdateKnowledgeSourceParams = MutateParams<MutationUpdateKnowledgeSource, MutateUpdateKnowledgeSourceRequest>

/**
 * Changes the details of a document: its module, topic, tags, title or visibility (the back end `updateKnowledgeSource`
 * mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateUpdateKnowledgeSource = async ({
    mutation = MutationUpdateKnowledgeSource.Mutation1,
    request,
    signal,
}: MutateUpdateKnowledgeSourceParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
