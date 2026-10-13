import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DecideBrainLessonMutation, DecideBrainLessonMutationVariables } from "../__generated__/graphql"

/** The response of the `decideBrainLesson` mutation: the typed payload straight from the back end contract. */
type MutateDecideBrainLessonResponse = DecideBrainLessonMutation

/** The input of the `decideBrainLesson` mutation. */
export type MutateDecideBrainLessonRequest = WireInput<DecideBrainLessonMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateDecideBrainLessonResponse,
    InputVariables<MutateDecideBrainLessonRequest>
> = gql`
    mutation DecideBrainLesson($input: DecideBrainLessonInput!) {
        decideBrainLesson(input: $input) {
            id
            status
        }
    }
`

enum MutationDecideBrainLesson {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDecideBrainLesson,
    TypedDocumentNode<MutateDecideBrainLessonResponse, InputVariables<MutateDecideBrainLessonRequest>>
> = {
    [MutationDecideBrainLesson.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDecideBrainLesson}. */
type MutateDecideBrainLessonParams = MutateParams<MutationDecideBrainLesson, MutateDecideBrainLessonRequest>

/**
 * Activates, rejects or retires a lesson of the shared brain (the back end `decideBrainLesson` mutation). Rejects with
 * the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateDecideBrainLesson = async ({
    mutation = MutationDecideBrainLesson.Mutation1,
    request,
    signal,
}: MutateDecideBrainLessonParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
