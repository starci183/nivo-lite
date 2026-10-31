import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RequestDossierReviewMutation, RequestDossierReviewMutationVariables } from "../__generated__/graphql"

/** The response of the `requestDossierReview` mutation: the typed payload straight from the back end contract. */
type MutateRequestDossierReviewResponse = RequestDossierReviewMutation

/** The input of the `requestDossierReview` mutation. */
export type MutateRequestDossierReviewRequest = WireInput<RequestDossierReviewMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateRequestDossierReviewResponse,
    InputVariables<MutateRequestDossierReviewRequest>
> = gql`
    mutation RequestDossierReview($input: RequestDossierReviewInput!) {
        requestDossierReview(input: $input) {
            id
            scope
            dossierId
            status
            createdAt
        }
    }
`

enum MutationRequestDossierReview {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestDossierReview,
    TypedDocumentNode<MutateRequestDossierReviewResponse, InputVariables<MutateRequestDossierReviewRequest>>
> = {
    [MutationRequestDossierReview.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestDossierReview}. */
type MutateRequestDossierReviewParams = MutateParams<MutationRequestDossierReview, MutateRequestDossierReviewRequest>

/**
 * Asks for a review of one dossier, or of the whole set when no dossier is named; a run already queued answers as it is (the back end `requestDossierReview` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRequestDossierReview = async ({
    mutation = MutationRequestDossierReview.Mutation1,
    request,
    signal,
}: MutateRequestDossierReviewParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
