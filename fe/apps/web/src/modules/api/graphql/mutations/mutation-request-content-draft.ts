import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestContentDraftMutation, RequestContentDraftMutationVariables } from "../__generated__/graphql"

/** Generated input of the `requestContentDraft` mutation. */
type MutateRequestContentDraftRequest = WireInput<RequestContentDraftMutationVariables["input"]>

/** Generated response of the `requestContentDraft` mutation. */
type MutateRequestContentDraftResponse = RequestContentDraftMutation

type Document = TypedDocumentNode<MutateRequestContentDraftResponse, InputVariables<MutateRequestContentDraftRequest>>

const mutation1: Document = gql`
    mutation RequestContentDraft($input: RequestContentDraftInput!) {
        requestContentDraft(input: $input) {
            id
            itemId
            status
        }
    }
`

enum MutationRequestContentDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRequestContentDraft, Document> = {
    [MutationRequestContentDraft.Mutation1]: mutation1,
}

/** Apollo options for the queued content operation. */
type MutateRequestContentDraftParams = MutateParams<MutationRequestContentDraft, MutateRequestContentDraftRequest>

/** Queues content AI work; completion is read through contentAiStatus. */
export const mutateRequestContentDraft = async ({
    mutation = MutationRequestContentDraft.Mutation1,
    request,
    signal,
}: MutateRequestContentDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
