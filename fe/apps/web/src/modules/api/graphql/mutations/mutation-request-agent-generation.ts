import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestAgentGenerationMutation, RequestAgentGenerationMutationVariables } from "../__generated__/graphql"

/** The input of the `requestAgentGeneration` mutation. */
type MutateRequestAgentGenerationRequest = WireInput<RequestAgentGenerationMutationVariables["input"]>

/** The response of the `requestAgentGeneration` mutation. */
type MutateRequestAgentGenerationResponse = RequestAgentGenerationMutation

type Document = TypedDocumentNode<
    MutateRequestAgentGenerationResponse,
    InputVariables<MutateRequestAgentGenerationRequest>
>

const mutation1: Document = gql`
    mutation RequestAgentGeneration($input: RequestAgentGenerationInput!) {
        requestAgentGeneration(input: $input) {
            ok
            generationId
            reason
            message
        }
    }
`

enum MutationRequestAgentGeneration {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestAgentGeneration, Document> = {
    [MutationRequestAgentGeneration.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestAgentGeneration}. */
type MutateRequestAgentGenerationParams = MutateParams<
    MutationRequestAgentGeneration,
    MutateRequestAgentGenerationRequest
>

/** Queues a text on the agent engine for the active workspace; poll it with `agentGenerationStatus`. */
export const mutateRequestAgentGeneration = async ({
    mutation = MutationRequestAgentGeneration.Mutation1,
    request,
    signal,
}: MutateRequestAgentGenerationParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
