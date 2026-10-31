import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ResolveDossierFindingMutation, ResolveDossierFindingMutationVariables } from "../__generated__/graphql"

/** The response of the `resolveDossierFinding` mutation: the typed payload straight from the back end contract. */
type MutateResolveDossierFindingResponse = ResolveDossierFindingMutation

/** The input of the `resolveDossierFinding` mutation. */
export type MutateResolveDossierFindingRequest = WireInput<ResolveDossierFindingMutationVariables["input"]>

const mutation1: TypedDocumentNode<
    MutateResolveDossierFindingResponse,
    InputVariables<MutateResolveDossierFindingRequest>
> = gql`
    mutation ResolveDossierFinding($input: ResolveDossierFindingInput!) {
        resolveDossierFinding(input: $input) {
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

enum MutationResolveDossierFinding {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationResolveDossierFinding,
    TypedDocumentNode<MutateResolveDossierFindingResponse, InputVariables<MutateResolveDossierFindingRequest>>
> = {
    [MutationResolveDossierFinding.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateResolveDossierFinding}. */
type MutateResolveDossierFindingParams = MutateParams<MutationResolveDossierFinding, MutateResolveDossierFindingRequest>

/**
 * Marks a finding done by hand, with the note of what was done outside (the back end `resolveDossierFinding` mutation).
 * Rejects with the back end failure (`CombinedGraphQLErrors`, message localized by the server).
 */
export const mutateResolveDossierFinding = async ({
    mutation = MutationResolveDossierFinding.Mutation1,
    request,
    signal,
}: MutateResolveDossierFindingParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
