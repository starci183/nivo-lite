import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RescreenHiringCandidateMutation,
    RescreenHiringCandidateMutationVariables,
} from "../__generated__/graphql"

/** The input of the `rescreenHiringCandidate` mutation. */
export type MutateRescreenHiringCandidateRequest = WireInput<RescreenHiringCandidateMutationVariables["input"]>

/** The response of the `rescreenHiringCandidate` mutation. */
type MutateRescreenHiringCandidateResponse = RescreenHiringCandidateMutation

const mutation1: TypedDocumentNode<
    MutateRescreenHiringCandidateResponse,
    InputVariables<MutateRescreenHiringCandidateRequest>
> = gql`
    mutation RescreenHiringCandidate($input: HiringCandidateRefInput!) {
        rescreenHiringCandidate(input: $input) {
            error
            status
            summary
        }
    }
`

enum MutationRescreenHiringCandidate {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRescreenHiringCandidate,
    TypedDocumentNode<MutateRescreenHiringCandidateResponse, InputVariables<MutateRescreenHiringCandidateRequest>>
> = {
    [MutationRescreenHiringCandidate.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRescreenHiringCandidate}. */
type MutateRescreenHiringCandidateParams = MutateParams<
    MutationRescreenHiringCandidate,
    MutateRescreenHiringCandidateRequest
>

/** Runs the `rescreenHiringCandidate` mutation. */
export const mutateRescreenHiringCandidate = async ({
    mutation = MutationRescreenHiringCandidate.Mutation1,
    request,
    signal,
}: MutateRescreenHiringCandidateParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
