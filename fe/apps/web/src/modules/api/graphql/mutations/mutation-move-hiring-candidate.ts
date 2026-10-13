import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { MoveHiringCandidateMutation, MoveHiringCandidateMutationVariables } from "../__generated__/graphql"

/** The input of the `moveHiringCandidate` mutation. */
export type MutateMoveHiringCandidateRequest = WireInput<MoveHiringCandidateMutationVariables["input"]>

/** The response of the `moveHiringCandidate` mutation. */
type MutateMoveHiringCandidateResponse = MoveHiringCandidateMutation

const mutation1: TypedDocumentNode<
    MutateMoveHiringCandidateResponse,
    InputVariables<MutateMoveHiringCandidateRequest>
> = gql`
    mutation MoveHiringCandidate($input: MoveHiringCandidateInput!) {
        moveHiringCandidate(input: $input) {
            stage
        }
    }
`

enum MutationMoveHiringCandidate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationMoveHiringCandidate,
    TypedDocumentNode<MutateMoveHiringCandidateResponse, InputVariables<MutateMoveHiringCandidateRequest>>
> = {
    [MutationMoveHiringCandidate.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateMoveHiringCandidate}. */
type MutateMoveHiringCandidateParams = MutateParams<MutationMoveHiringCandidate, MutateMoveHiringCandidateRequest>

/** Runs the `moveHiringCandidate` mutation. */
export const mutateMoveHiringCandidate = async ({
    mutation = MutationMoveHiringCandidate.Mutation1,
    request,
    signal,
}: MutateMoveHiringCandidateParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
