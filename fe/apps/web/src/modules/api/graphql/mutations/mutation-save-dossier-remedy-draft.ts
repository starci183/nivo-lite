import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveDossierRemedyDraftMutation, SaveDossierRemedyDraftMutationVariables } from "../__generated__/graphql"

/** The response of the `saveDossierRemedyDraft` mutation: the typed payload straight from the back end contract. */
type MutateSaveDossierRemedyDraftResponse = SaveDossierRemedyDraftMutation

/** The input of the `saveDossierRemedyDraft` mutation. */
export type MutateSaveDossierRemedyDraftRequest = WireInput<SaveDossierRemedyDraftMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateSaveDossierRemedyDraftResponse,
    InputVariables<MutateSaveDossierRemedyDraftRequest>
> = gql`
    mutation SaveDossierRemedyDraft($input: SaveDossierRemedyDraftInput!) {
        saveDossierRemedyDraft(input: $input) {
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

enum MutationSaveDossierRemedyDraft {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveDossierRemedyDraft,
    TypedDocumentNode<MutateSaveDossierRemedyDraftResponse, InputVariables<MutateSaveDossierRemedyDraftRequest>>
> = {
    [MutationSaveDossierRemedyDraft.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveDossierRemedyDraft}. */
type MutateSaveDossierRemedyDraftParams = MutateParams<
    MutationSaveDossierRemedyDraft,
    MutateSaveDossierRemedyDraftRequest
>

/**
 * Saves the owner's edits of the title and body of a proposed draft (the back end `saveDossierRemedyDraft` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateSaveDossierRemedyDraft = async ({
    mutation = MutationSaveDossierRemedyDraft.Mutation1,
    request,
    signal,
}: MutateSaveDossierRemedyDraftParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
