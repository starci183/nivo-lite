import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    ApproveDossierRemedyDraftMutation,
    ApproveDossierRemedyDraftMutationVariables,
} from "../__generated__/graphql"

/** The response of the `approveDossierRemedyDraft` mutation: the typed payload straight from the back end contract. */
type MutateApproveDossierRemedyDraftResponse = ApproveDossierRemedyDraftMutation

/** The input of the `approveDossierRemedyDraft` mutation. */
export type MutateApproveDossierRemedyDraftRequest = WireInput<ApproveDossierRemedyDraftMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateApproveDossierRemedyDraftResponse,
    InputVariables<MutateApproveDossierRemedyDraftRequest>
> = gql`
    mutation ApproveDossierRemedyDraft($input: DossierRemedyDraftRefInput!) {
        approveDossierRemedyDraft(input: $input) {
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

enum MutationApproveDossierRemedyDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApproveDossierRemedyDraft,
    TypedDocumentNode<MutateApproveDossierRemedyDraftResponse, InputVariables<MutateApproveDossierRemedyDraftRequest>>
> = {
    [MutationApproveDossierRemedyDraft.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateApproveDossierRemedyDraft}. */
type MutateApproveDossierRemedyDraftParams = MutateParams<
    MutationApproveDossierRemedyDraft,
    MutateApproveDossierRemedyDraftRequest
>

/**
 * Approves a proposed draft: it becomes a document of the dossier and the finding is resolved (the back end `approveDossierRemedyDraft` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateApproveDossierRemedyDraft = async ({
    mutation = MutationApproveDossierRemedyDraft.Mutation1,
    request,
    signal,
}: MutateApproveDossierRemedyDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
