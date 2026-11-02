import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DraftPublicDocumentMutation, DraftPublicDocumentMutationVariables } from "../__generated__/graphql"

/** The response of the `draftPublicDocument` mutation: the typed payload straight from the back end contract. */
type MutateDraftPublicDocumentResponse = DraftPublicDocumentMutation

/** The input of the `draftPublicDocument` mutation. */
export type MutateDraftPublicDocumentRequest = WireInput<DraftPublicDocumentMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateDraftPublicDocumentResponse,
    InputVariables<MutateDraftPublicDocumentRequest>
> = gql`
    mutation DraftPublicDocument($input: DraftPublicDocumentInput!) {
        draftPublicDocument(input: $input) {
            id
            title
            body
            publishedBody
            draftRevision
            status
            kind
            question
            gapId
            sources {
                sourceId
                title
                changed
            }
            leftOut {
                label
                reason
            }
            needsReview
            hasPendingChange
            approvedByName
            approvedAt
            failureCode
            createdAt
            updatedAt
        }
    }
`

enum MutationDraftPublicDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDraftPublicDocument,
    TypedDocumentNode<MutateDraftPublicDocumentResponse, InputVariables<MutateDraftPublicDocumentRequest>>
> = {
    [MutationDraftPublicDocument.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDraftPublicDocument}. */
type MutateDraftPublicDocumentParams = MutateParams<MutationDraftPublicDocument, MutateDraftPublicDocumentRequest>

/**
 * NIVO drafts a public document from internal documents, with nobody asking it in a customer chat (the back end `draftPublicDocument` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateDraftPublicDocument = async ({
    mutation = MutationDraftPublicDocument.Mutation1,
    request,
    signal,
}: MutateDraftPublicDocumentParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
