import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RejectDossierRemedyDraftMutation,
    RejectDossierRemedyDraftMutationVariables,
} from "../__generated__/graphql"

/** The response of the `rejectDossierRemedyDraft` mutation: the typed payload straight from the back end contract. */
type MutateRejectDossierRemedyDraftResponse = RejectDossierRemedyDraftMutation

/** The input of the `rejectDossierRemedyDraft` mutation. */
export type MutateRejectDossierRemedyDraftRequest = WireInput<RejectDossierRemedyDraftMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateRejectDossierRemedyDraftResponse,
    InputVariables<MutateRejectDossierRemedyDraftRequest>
> = gql`
    mutation RejectDossierRemedyDraft($input: RejectDossierRemedyDraftInput!) {
        rejectDossierRemedyDraft(input: $input) {
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

enum MutationRejectDossierRemedyDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRejectDossierRemedyDraft,
    TypedDocumentNode<MutateRejectDossierRemedyDraftResponse, InputVariables<MutateRejectDossierRemedyDraftRequest>>
> = {
    [MutationRejectDossierRemedyDraft.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRejectDossierRemedyDraft}. */
type MutateRejectDossierRemedyDraftParams = MutateParams<
    MutationRejectDossierRemedyDraft,
    MutateRejectDossierRemedyDraftRequest
>

/**
 * Rejects a proposed draft, with an optional reason; the finding stays as it was (the back end `rejectDossierRemedyDraft` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateRejectDossierRemedyDraft = async ({
    mutation = MutationRejectDossierRemedyDraft.Mutation1,
    request,
    signal,
}: MutateRejectDossierRemedyDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
