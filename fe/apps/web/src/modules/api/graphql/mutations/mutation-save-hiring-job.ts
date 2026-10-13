import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveHiringJobMutation, SaveHiringJobMutationVariables } from "../__generated__/graphql"

/** The input of the `saveHiringJob` mutation. */
export type MutateSaveHiringJobRequest = WireInput<SaveHiringJobMutationVariables["input"]>

/** The response of the `saveHiringJob` mutation. */
type MutateSaveHiringJobResponse = SaveHiringJobMutation

const mutation1: TypedDocumentNode<MutateSaveHiringJobResponse, InputVariables<MutateSaveHiringJobRequest>> = gql`
    mutation SaveHiringJob($input: SaveHiringJobInput!) {
        saveHiringJob(input: $input) {
            id
            slug
        }
    }
`

enum MutationSaveHiringJob {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveHiringJob,
    TypedDocumentNode<MutateSaveHiringJobResponse, InputVariables<MutateSaveHiringJobRequest>>
> = {
    [MutationSaveHiringJob.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveHiringJob}. */
type MutateSaveHiringJobParams = MutateParams<MutationSaveHiringJob, MutateSaveHiringJobRequest>

/** Runs the `saveHiringJob` mutation. */
export const mutateSaveHiringJob = async ({
    mutation = MutationSaveHiringJob.Mutation1,
    request,
    signal,
}: MutateSaveHiringJobParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
