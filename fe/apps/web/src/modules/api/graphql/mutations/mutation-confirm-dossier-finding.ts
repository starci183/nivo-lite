import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ConfirmDossierFindingMutation, ConfirmDossierFindingMutationVariables } from "../__generated__/graphql"

/** The response of the `confirmDossierFinding` mutation: the typed payload straight from the back end contract. */
type MutateConfirmDossierFindingResponse = ConfirmDossierFindingMutation

/** The input of the `confirmDossierFinding` mutation. */
export type MutateConfirmDossierFindingRequest = WireInput<ConfirmDossierFindingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateConfirmDossierFindingResponse,
    InputVariables<MutateConfirmDossierFindingRequest>
> = gql`
    mutation ConfirmDossierFinding($input: DossierFindingNoteInput!) {
        confirmDossierFinding(input: $input) {
            id
            status
            resolution
            dismissReason
            decisionNote
            assigneeId
            dueAt
            draftId
            draftStatus
        }
    }
`

enum MutationConfirmDossierFinding {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationConfirmDossierFinding,
    TypedDocumentNode<MutateConfirmDossierFindingResponse, InputVariables<MutateConfirmDossierFindingRequest>>
> = {
    [MutationConfirmDossierFinding.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateConfirmDossierFinding}. */
type MutateConfirmDossierFindingParams = MutateParams<MutationConfirmDossierFinding, MutateConfirmDossierFindingRequest>

/**
 * Confirms an open finding, with an optional note (the back end `confirmDossierFinding` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateConfirmDossierFinding = async ({
    mutation = MutationConfirmDossierFinding.Mutation1,
    request,
    signal,
}: MutateConfirmDossierFindingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
