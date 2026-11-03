import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ApprovePublicDocumentMutation, ApprovePublicDocumentMutationVariables } from "../__generated__/graphql"

/** The response of the `approvePublicDocument` mutation: the typed payload straight from the back end contract. */
type MutateApprovePublicDocumentResponse = ApprovePublicDocumentMutation

/** The input of the `approvePublicDocument` mutation. */
export type MutateApprovePublicDocumentRequest = WireInput<ApprovePublicDocumentMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateApprovePublicDocumentResponse,
    InputVariables<MutateApprovePublicDocumentRequest>
> = gql`
    mutation ApprovePublicDocument($input: ApprovePublicDocumentInput!) {
        approvePublicDocument(input: $input) {
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

enum MutationApprovePublicDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApprovePublicDocument,
    TypedDocumentNode<MutateApprovePublicDocumentResponse, InputVariables<MutateApprovePublicDocumentRequest>>
> = {
    [MutationApprovePublicDocument.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateApprovePublicDocument}. */
type MutateApprovePublicDocumentParams = MutateParams<MutationApprovePublicDocument, MutateApprovePublicDocumentRequest>

/**
 * The owner approves a public document, which publishes it (the back end `approvePublicDocument` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateApprovePublicDocument = async ({
    mutation = MutationApprovePublicDocument.Mutation1,
    request,
    signal,
}: MutateApprovePublicDocumentParams): Promise<ApolloClient.MutateResult<MutateApprovePublicDocumentResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
