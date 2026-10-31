import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { DismissDossierFindingMutation, DismissDossierFindingMutationVariables } from "../__generated__/graphql"

/** The response of the `dismissDossierFinding` mutation: the typed payload straight from the back end contract. */
type MutateDismissDossierFindingResponse = DismissDossierFindingMutation

/** The input of the `dismissDossierFinding` mutation. */
export type MutateDismissDossierFindingRequest = WireInput<DismissDossierFindingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateDismissDossierFindingResponse,
    InputVariables<MutateDismissDossierFindingRequest>
> = gql`
    mutation DismissDossierFinding($input: DismissDossierFindingInput!) {
        dismissDossierFinding(input: $input) {
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

enum MutationDismissDossierFinding {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDismissDossierFinding,
    TypedDocumentNode<MutateDismissDossierFindingResponse, InputVariables<MutateDismissDossierFindingRequest>>
> = {
    [MutationDismissDossierFinding.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDismissDossierFinding}. */
type MutateDismissDossierFindingParams = MutateParams<MutationDismissDossierFinding, MutateDismissDossierFindingRequest>

/**
 * Dismisses a finding, with the reason that keeps NIVO from raising it again while the documents stay the same (the back end `dismissDossierFinding` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateDismissDossierFinding = async ({
    mutation = MutationDismissDossierFinding.Mutation1,
    request,
    signal,
}: MutateDismissDossierFindingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
