import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { AssignBrainDossierMutation, AssignBrainDossierMutationVariables } from "../__generated__/graphql"

/** The response of the `assignBrainDossier` mutation: the typed payload straight from the back end contract. */
type MutateAssignBrainDossierResponse = AssignBrainDossierMutation

/** The input of the `assignBrainDossier` mutation. */
export type MutateAssignBrainDossierRequest = WireInput<AssignBrainDossierMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateAssignBrainDossierResponse,
    InputVariables<MutateAssignBrainDossierRequest>
> = gql`
    mutation AssignBrainDossier($input: AssignBrainDossierInput!) {
        assignBrainDossier(input: $input) {
            id
            assigneeId
            dueAt
        }
    }
`

enum MutationAssignBrainDossier {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationAssignBrainDossier,
    TypedDocumentNode<MutateAssignBrainDossierResponse, InputVariables<MutateAssignBrainDossierRequest>>
> = {
    [MutationAssignBrainDossier.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateAssignBrainDossier}. */
type MutateAssignBrainDossierParams = MutateParams<MutationAssignBrainDossier, MutateAssignBrainDossierRequest>

/**
 * Gives a dossier to a member of the workspace with an optional due date, or takes both back (the back end `assignBrainDossier` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateAssignBrainDossier = async ({
    mutation = MutationAssignBrainDossier.Mutation1,
    request,
    signal,
}: MutateAssignBrainDossierParams): Promise<ApolloClient.MutateResult<MutateAssignBrainDossierResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
