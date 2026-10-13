import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDeleteHiringCandidateArgs } from "../__generated__/schema"

/** The input of the `deleteHiringCandidate` mutation. */
export type MutateDeleteHiringCandidateRequest = MutationDeleteHiringCandidateArgs["input"]

/** The response of the `deleteHiringCandidate` mutation. */
type MutateDeleteHiringCandidateResponse = Pick<Mutation, "deleteHiringCandidate">

const mutation1: TypedDocumentNode<
    MutateDeleteHiringCandidateResponse,
    InputVariables<MutateDeleteHiringCandidateRequest>
> = gql`
    mutation DeleteHiringCandidate($input: HiringCandidateRefInput!) {
        deleteHiringCandidate(input: $input) {
            files
        }
    }
`

enum MutationDeleteHiringCandidate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDeleteHiringCandidate,
    TypedDocumentNode<MutateDeleteHiringCandidateResponse, InputVariables<MutateDeleteHiringCandidateRequest>>
> = {
    [MutationDeleteHiringCandidate.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDeleteHiringCandidate}. */
type MutateDeleteHiringCandidateParams = MutateParams<MutationDeleteHiringCandidate, MutateDeleteHiringCandidateRequest>

/** Runs the `deleteHiringCandidate` mutation. */
export const mutateDeleteHiringCandidate = async ({
    mutation = MutationDeleteHiringCandidate.Mutation1,
    request,
    signal,
}: MutateDeleteHiringCandidateParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
