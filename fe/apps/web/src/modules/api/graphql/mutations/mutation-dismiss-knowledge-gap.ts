import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDismissKnowledgeGapArgs } from "../__generated__/schema"

/** The response of the `dismissKnowledgeGap` mutation: the typed payload straight from the back end contract. */
type MutateDismissKnowledgeGapResponse = Pick<Mutation, "dismissKnowledgeGap">

/** The input of the `dismissKnowledgeGap` mutation. */
export type MutateDismissKnowledgeGapRequest = MutationDismissKnowledgeGapArgs["input"]

const mutation1: TypedDocumentNode<
    MutateDismissKnowledgeGapResponse,
    InputVariables<MutateDismissKnowledgeGapRequest>
> = gql`
    mutation DismissKnowledgeGap($input: DismissKnowledgeGapInput!) {
        dismissKnowledgeGap(input: $input)
    }
`

enum MutationDismissKnowledgeGap {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDismissKnowledgeGap,
    TypedDocumentNode<MutateDismissKnowledgeGapResponse, InputVariables<MutateDismissKnowledgeGapRequest>>
> = {
    [MutationDismissKnowledgeGap.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDismissKnowledgeGap}. */
type MutateDismissKnowledgeGapParams = MutateParams<MutationDismissKnowledgeGap, MutateDismissKnowledgeGapRequest>

/**
 * Dismisses a question the agents could not answer so it stops asking for attention (the back end `dismissKnowledgeGap`
 * mutation). Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateDismissKnowledgeGap = async ({
    mutation = MutationDismissKnowledgeGap.Mutation1,
    request,
    signal,
}: MutateDismissKnowledgeGapParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
