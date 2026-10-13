import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationRequestContentQuickDraftArgs } from "../__generated__/schema"

/** Generated input of the `requestContentQuickDraft` mutation. */
type MutateRequestContentQuickDraftRequest = MutationRequestContentQuickDraftArgs["input"]

/** Generated response of the `requestContentQuickDraft` mutation. */
type MutateRequestContentQuickDraftResponse = Pick<Mutation, "requestContentQuickDraft">

type Document = TypedDocumentNode<
    MutateRequestContentQuickDraftResponse,
    InputVariables<MutateRequestContentQuickDraftRequest>
>

const mutation1: Document = gql`
    mutation RequestContentQuickDraft($input: RequestContentQuickDraftInput!) {
        requestContentQuickDraft(input: $input) {
            id
            itemId
            status
        }
    }
`

enum MutationRequestContentQuickDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestContentQuickDraft, Document> = {
    [MutationRequestContentQuickDraft.Mutation1]: mutation1,
}

/** Apollo options for the queued content operation. */
type MutateRequestContentQuickDraftParams = MutateParams<
    MutationRequestContentQuickDraft,
    MutateRequestContentQuickDraftRequest
>

/** Queues content AI work; completion is read through contentAiStatus. */
export const mutateRequestContentQuickDraft = async ({
    mutation = MutationRequestContentQuickDraft.Mutation1,
    request,
    signal,
}: MutateRequestContentQuickDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
