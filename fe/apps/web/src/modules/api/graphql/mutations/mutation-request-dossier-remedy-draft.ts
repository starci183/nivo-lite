import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RequestDossierRemedyDraftMutation,
    RequestDossierRemedyDraftMutationVariables,
} from "../__generated__/graphql"

/** The response of the `requestDossierRemedyDraft` mutation: the typed payload straight from the back end contract. */
type MutateRequestDossierRemedyDraftResponse = RequestDossierRemedyDraftMutation

/** The input of the `requestDossierRemedyDraft` mutation. */
export type MutateRequestDossierRemedyDraftRequest = WireInput<RequestDossierRemedyDraftMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateRequestDossierRemedyDraftResponse,
    InputVariables<MutateRequestDossierRemedyDraftRequest>
> = gql`
    mutation RequestDossierRemedyDraft($input: RequestDossierRemedyDraftInput!) {
        requestDossierRemedyDraft(input: $input) {
            id
            findingId
            dossierId
            status
            title
            documentType
            body
            placeholders {
                label
                reason
            }
            error
            sourceId
            instructions
            rejectReason
            decidedAt
            createdAt
            updatedAt
        }
    }
`

enum MutationRequestDossierRemedyDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRequestDossierRemedyDraft,
    TypedDocumentNode<MutateRequestDossierRemedyDraftResponse, InputVariables<MutateRequestDossierRemedyDraftRequest>>
> = {
    [MutationRequestDossierRemedyDraft.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRequestDossierRemedyDraft}. */
type MutateRequestDossierRemedyDraftParams = MutateParams<
    MutationRequestDossierRemedyDraft,
    MutateRequestDossierRemedyDraftRequest
>

/**
 * Asks NIVO to draft the document that completes a finding (the back end `requestDossierRemedyDraft` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRequestDossierRemedyDraft = async ({
    mutation = MutationRequestDossierRemedyDraft.Mutation1,
    request,
    signal,
}: MutateRequestDossierRemedyDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
