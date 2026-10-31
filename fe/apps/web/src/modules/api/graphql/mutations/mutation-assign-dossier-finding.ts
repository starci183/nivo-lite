import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AssignDossierFindingMutation, AssignDossierFindingMutationVariables } from "../__generated__/graphql"

/** The response of the `assignDossierFinding` mutation: the typed payload straight from the back end contract. */
type MutateAssignDossierFindingResponse = AssignDossierFindingMutation

/** The input of the `assignDossierFinding` mutation. */
export type MutateAssignDossierFindingRequest = WireInput<AssignDossierFindingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateAssignDossierFindingResponse,
    InputVariables<MutateAssignDossierFindingRequest>
> = gql`
    mutation AssignDossierFinding($input: AssignDossierFindingInput!) {
        assignDossierFinding(input: $input) {
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

enum MutationAssignDossierFinding {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAssignDossierFinding,
    TypedDocumentNode<MutateAssignDossierFindingResponse, InputVariables<MutateAssignDossierFindingRequest>>
> = {
    [MutationAssignDossierFinding.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAssignDossierFinding}. */
type MutateAssignDossierFindingParams = MutateParams<MutationAssignDossierFinding, MutateAssignDossierFindingRequest>

/**
 * Gives a finding to a member of the workspace, with an optional due date (the back end `assignDossierFinding` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateAssignDossierFinding = async ({
    mutation = MutationAssignDossierFinding.Mutation1,
    request,
    signal,
}: MutateAssignDossierFindingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
