import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { SaveShiftsCoverageMutation, SaveShiftsCoverageMutationVariables } from "../__generated__/graphql"

/** The input of the `saveShiftsCoverage` mutation. */
export type MutateSaveShiftsCoverageRequest = WireInput<SaveShiftsCoverageMutationVariables["input"]>

/** The response of the `saveShiftsCoverage` mutation. */
type MutateSaveShiftsCoverageResponse = SaveShiftsCoverageMutation

const mutation1: TypedDocumentNode<
    MutateSaveShiftsCoverageResponse,
    InputVariables<MutateSaveShiftsCoverageRequest>
> = gql`
    mutation SaveShiftsCoverage($input: SaveShiftsCoverageInput!) {
        saveShiftsCoverage(input: $input)
    }
`

enum MutationSaveShiftsCoverage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationSaveShiftsCoverage,
    TypedDocumentNode<MutateSaveShiftsCoverageResponse, InputVariables<MutateSaveShiftsCoverageRequest>>
> = {
    [MutationSaveShiftsCoverage.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateSaveShiftsCoverage}. */
type MutateSaveShiftsCoverageParams = MutateParams<MutationSaveShiftsCoverage, MutateSaveShiftsCoverageRequest>

/** Runs the `saveShiftsCoverage` mutation. */
export const mutateSaveShiftsCoverage = async ({
    mutation = MutationSaveShiftsCoverage.Mutation1,
    request,
    signal,
}: MutateSaveShiftsCoverageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
