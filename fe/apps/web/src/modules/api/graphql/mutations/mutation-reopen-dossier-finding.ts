import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ReopenDossierFindingMutation, ReopenDossierFindingMutationVariables } from "../__generated__/graphql"

/** The response of the `reopenDossierFinding` mutation: the typed payload straight from the back end contract. */
type MutateReopenDossierFindingResponse = ReopenDossierFindingMutation

/** The input of the `reopenDossierFinding` mutation. */
export type MutateReopenDossierFindingRequest = WireInput<ReopenDossierFindingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateReopenDossierFindingResponse,
    InputVariables<MutateReopenDossierFindingRequest>
> = gql`
    mutation ReopenDossierFinding($input: DossierFindingRefInput!) {
        reopenDossierFinding(input: $input) {
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

enum MutationReopenDossierFinding {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationReopenDossierFinding,
    TypedDocumentNode<MutateReopenDossierFindingResponse, InputVariables<MutateReopenDossierFindingRequest>>
> = {
    [MutationReopenDossierFinding.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateReopenDossierFinding}. */
type MutateReopenDossierFindingParams = MutateParams<MutationReopenDossierFinding, MutateReopenDossierFindingRequest>

/**
 * Opens a dismissed or resolved finding again (the back end `reopenDossierFinding` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateReopenDossierFinding = async ({
    mutation = MutationReopenDossierFinding.Mutation1,
    request,
    signal,
}: MutateReopenDossierFindingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
