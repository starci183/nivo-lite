import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createNoAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationApplyToHiringJobArgs } from "../__generated__/schema"

/** The input of the `applyToHiringJob` mutation. */
export type MutateApplyToHiringJobRequest = MutationApplyToHiringJobArgs["input"]

/** The response of the `applyToHiringJob` mutation. */
type MutateApplyToHiringJobResponse = Pick<Mutation, "applyToHiringJob">

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
