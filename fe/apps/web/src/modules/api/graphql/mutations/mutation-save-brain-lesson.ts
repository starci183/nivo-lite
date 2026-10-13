import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveBrainLessonArgs } from "../__generated__/schema"

/** The response of the `saveBrainLesson` mutation: the typed payload straight from the back end contract. */
type MutateSaveBrainLessonResponse = Pick<Mutation, "saveBrainLesson">

/** The input of the `saveBrainLesson` mutation. */
export type MutateSaveBrainLessonRequest = MutationSaveBrainLessonArgs["input"]

const mutation1: TypedDocumentNode<MutateSaveBrainLessonResponse, InputVariables<MutateSaveBrainLessonRequest>> = gql`
    mutation SaveBrainLesson($input: SaveBrainLessonInput!) {
        saveBrainLesson(input: $input) {
            id
            status
        }
    }
`

enum MutationSaveBrainLesson {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveBrainLesson,
    TypedDocumentNode<MutateSaveBrainLessonResponse, InputVariables<MutateSaveBrainLessonRequest>>
> = {
    [MutationSaveBrainLesson.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveBrainLesson}. */
type MutateSaveBrainLessonParams = MutateParams<MutationSaveBrainLesson, MutateSaveBrainLessonRequest>

/**
 * Writes a lesson of the shared brain (the back end `saveBrainLesson` mutation). Rejects with the back end failure
 * (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateSaveBrainLesson = async ({
    mutation = MutationSaveBrainLesson.Mutation1,
    request,
    signal,
}: MutateSaveBrainLessonParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
