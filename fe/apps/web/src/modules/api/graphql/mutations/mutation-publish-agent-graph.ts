import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { PublishAgentGraphMutation, PublishAgentGraphMutationVariables } from "../__generated__/graphql"

/** The input of the `publishAgentGraph` mutation. */
type MutatePublishAgentGraphRequest = WireInput<PublishAgentGraphMutationVariables["input"]>

/** The response of the `publishAgentGraph` mutation: the typed payload straight from the back end contract. */
type MutatePublishAgentGraphResponse = PublishAgentGraphMutation

type Document = TypedDocumentNode<MutatePublishAgentGraphResponse, InputVariables<MutatePublishAgentGraphRequest>>

const mutation1: Document = gql`
    mutation PublishAgentGraph($input: PublishAgentGraphInput!) {
        publishAgentGraph(input: $input) {
            id
            version
        }
    }
`

enum MutationPublishAgentGraph {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationPublishAgentGraph, Document> = {
    [MutationPublishAgentGraph.Mutation1]: mutation1,
}

/** Apollo params for {@link mutatePublishAgentGraph}. */
type MutatePublishAgentGraphParams = MutateParams<MutationPublishAgentGraph, MutatePublishAgentGraphRequest>

/** The back end `publishAgentGraph` mutation. */
export const mutatePublishAgentGraph = async ({
    mutation = MutationPublishAgentGraph.Mutation1,
    request,
    signal,
}: MutatePublishAgentGraphParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
