import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestLessonMiningArgs } from "../__generated__/schema"

/** The response of the `requestLessonMining` mutation: the typed payload straight from the back end contract. */
type MutateRequestLessonMiningResponse = Pick<Mutation, "requestLessonMining">

/** The input of the `requestLessonMining` mutation. */
export type MutateRequestLessonMiningRequest = MutationRequestLessonMiningArgs["input"]

const mutation1: TypedDocumentNode<
    MutateRequestLessonMiningResponse,
    InputVariables<MutateRequestLessonMiningRequest>
> = gql`
    mutation RequestLessonMining($input: RequestLessonMiningInput!) {
        requestLessonMining(input: $input) {
            id
        }
    }
`

enum MutationRequestLessonMining {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestLessonMining,
    TypedDocumentNode<MutateRequestLessonMiningResponse, InputVariables<MutateRequestLessonMiningRequest>>
> = {
    [MutationRequestLessonMining.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestLessonMining}. */
type MutateRequestLessonMiningParams = MutateParams<MutationRequestLessonMining, MutateRequestLessonMiningRequest>

/**
 * Asks the back end to study the corrections of one agent and propose lessons; answers the command id to poll through
 * `lessonMiningStatus` (the back end `requestLessonMining` mutation). Rejects with the back end failure
 * (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRequestLessonMining = async ({
    mutation = MutationRequestLessonMining.Mutation1,
    request,
    signal,
}: MutateRequestLessonMiningParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
