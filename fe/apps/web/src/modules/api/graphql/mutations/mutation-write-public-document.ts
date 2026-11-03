import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { WritePublicDocumentMutation, WritePublicDocumentMutationVariables } from "../__generated__/graphql"

/** The response of the `writePublicDocument` mutation: the typed payload straight from the back end contract. */
type MutateWritePublicDocumentResponse = WritePublicDocumentMutation

/** The input of the `writePublicDocument` mutation. */
export type MutateWritePublicDocumentRequest = WireInput<WritePublicDocumentMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateWritePublicDocumentResponse,
    InputVariables<MutateWritePublicDocumentRequest>
> = gql`
    mutation WritePublicDocument($input: WritePublicDocumentInput!) {
        writePublicDocument(input: $input) {
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

enum MutationWritePublicDocument {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationWritePublicDocument,
    TypedDocumentNode<MutateWritePublicDocumentResponse, InputVariables<MutateWritePublicDocumentRequest>>
> = {
    [MutationWritePublicDocument.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateWritePublicDocument}. */
type MutateWritePublicDocumentParams = MutateParams<MutationWritePublicDocument, MutateWritePublicDocumentRequest>

/**
 * The owner writes a public document by hand (the back end `writePublicDocument` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateWritePublicDocument = async ({
    mutation = MutationWritePublicDocument.Mutation1,
    request,
    signal,
}: MutateWritePublicDocumentParams): Promise<ApolloClient.MutateResult<MutateWritePublicDocumentResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
