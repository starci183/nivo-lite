import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ApplyToHiringJobMutation, ApplyToHiringJobMutationVariables } from "../__generated__/graphql"

/** The input of the `applyToHiringJob` mutation. */
export type MutateApplyToHiringJobRequest = WireInput<ApplyToHiringJobMutationVariables["input"]>

/** The response of the `applyToHiringJob` mutation. */
type MutateApplyToHiringJobResponse = ApplyToHiringJobMutation

const mutation1: TypedDocumentNode<MutateApplyToHiringJobResponse, InputVariables<MutateApplyToHiringJobRequest>> = gql`
    mutation ApplyToHiringJob($input: ApplyToHiringJobInput!) {
        applyToHiringJob(input: $input) {
            duplicate
        }
    }
`

enum MutationApplyToHiringJob {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApplyToHiringJob,
    TypedDocumentNode<MutateApplyToHiringJobResponse, InputVariables<MutateApplyToHiringJobRequest>>
> = {
    [MutationApplyToHiringJob.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateApplyToHiringJob}. */
type MutateApplyToHiringJobParams = MutateParams<MutationApplyToHiringJob, MutateApplyToHiringJobRequest>

/** Runs the `applyToHiringJob` mutation (anonymous public door). */
export const mutateApplyToHiringJob = async ({
    mutation = MutationApplyToHiringJob.Mutation1,
    request,
    signal,
}: MutateApplyToHiringJobParams) => {
    const apollo = createNoAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
