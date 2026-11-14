import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AnswerBrainCritiqueMutation, AnswerBrainCritiqueMutationVariables } from "../__generated__/graphql"

/** The response of the `answerBrainCritique` mutation: the typed payload straight from the back end contract. */
type MutateAnswerBrainCritiqueResponse = AnswerBrainCritiqueMutation

/** The input of the `answerBrainCritique` mutation. */
export type MutateAnswerBrainCritiqueRequest = WireInput<AnswerBrainCritiqueMutationVariables["input"]>

const mutation1: TypedDocumentNode<MutateAnswerBrainCritiqueResponse, InputVariables<MutateAnswerBrainCritiqueRequest>> = gql`
    mutation AnswerBrainCritique($input: AnswerBrainCritiqueInput!) {
        answerBrainCritique(input: $input) {
            id
            state
            decidedAt
            answer {
                kind
                factId
                value
                situation
            }
        }
    }
`

enum MutationAnswerBrainCritique {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAnswerBrainCritique, TypedDocumentNode<MutateAnswerBrainCritiqueResponse, InputVariables<MutateAnswerBrainCritiqueRequest>>> = {
    [MutationAnswerBrainCritique.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAnswerBrainCritique}. */
type MutateAnswerBrainCritiqueParams = MutateParams<MutationAnswerBrainCritique, MutateAnswerBrainCritiqueRequest>

/**
 * Answers one point the document critic raised: a choice, a typed value or a free answer (the back end `answerBrainCritique` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateAnswerBrainCritique = async ({
    mutation = MutationAnswerBrainCritique.Mutation1,
    request,
    signal,
}: MutateAnswerBrainCritiqueParams): Promise<ApolloClient.MutateResult<MutateAnswerBrainCritiqueResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
