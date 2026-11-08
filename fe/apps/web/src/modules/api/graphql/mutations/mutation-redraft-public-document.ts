import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RedraftPublicDocumentMutation, RedraftPublicDocumentMutationVariables } from "../__generated__/graphql"

/** The response of the `redraftPublicDocument` mutation: the typed payload straight from the back end contract. */
type MutateRedraftPublicDocumentResponse = RedraftPublicDocumentMutation

/** The input of the `redraftPublicDocument` mutation. */
export type MutateRedraftPublicDocumentRequest = WireInput<RedraftPublicDocumentMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateRedraftPublicDocumentResponse,
    InputVariables<MutateRedraftPublicDocumentRequest>
> = gql`
    mutation RedraftPublicDocument($input: PublicDocumentIdInput!) {
        redraftPublicDocument(input: $input) {
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

enum MutationRedraftPublicDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRedraftPublicDocument,
    TypedDocumentNode<MutateRedraftPublicDocumentResponse, InputVariables<MutateRedraftPublicDocumentRequest>>
> = {
    [MutationRedraftPublicDocument.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRedraftPublicDocument}. */
type MutateRedraftPublicDocumentParams = MutateParams<MutationRedraftPublicDocument, MutateRedraftPublicDocumentRequest>

/**
 * NIVO drafts a public document again from its internal sources (the back end `redraftPublicDocument` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRedraftPublicDocument = async ({
    mutation = MutationRedraftPublicDocument.Mutation1,
    request,
    signal,
}: MutateRedraftPublicDocumentParams): Promise<ApolloClient.MutateResult<MutateRedraftPublicDocumentResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
