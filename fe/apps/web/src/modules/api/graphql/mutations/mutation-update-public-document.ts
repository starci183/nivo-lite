import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { UpdatePublicDocumentMutation, UpdatePublicDocumentMutationVariables } from "../__generated__/graphql"

/** The response of the `updatePublicDocument` mutation: the typed payload straight from the back end contract. */
type MutateUpdatePublicDocumentResponse = UpdatePublicDocumentMutation

/** The input of the `updatePublicDocument` mutation. */
export type MutateUpdatePublicDocumentRequest = WireInput<UpdatePublicDocumentMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateUpdatePublicDocumentResponse,
    InputVariables<MutateUpdatePublicDocumentRequest>
> = gql`
    mutation UpdatePublicDocument($input: UpdatePublicDocumentInput!) {
        updatePublicDocument(input: $input) {
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

enum MutationUpdatePublicDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationUpdatePublicDocument,
    TypedDocumentNode<MutateUpdatePublicDocumentResponse, InputVariables<MutateUpdatePublicDocumentRequest>>
> = {
    [MutationUpdatePublicDocument.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateUpdatePublicDocument}. */
type MutateUpdatePublicDocumentParams = MutateParams<MutationUpdatePublicDocument, MutateUpdatePublicDocumentRequest>

/**
 * Changes the title or the text of a public document (the back end `updatePublicDocument` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateUpdatePublicDocument = async ({
    mutation = MutationUpdatePublicDocument.Mutation1,
    request,
    signal,
}: MutateUpdatePublicDocumentParams): Promise<ApolloClient.MutateResult<MutateUpdatePublicDocumentResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
