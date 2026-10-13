import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RemoveShiftsCoverageMutation, RemoveShiftsCoverageMutationVariables } from "../__generated__/graphql"

/** The input of the `removeShiftsCoverage` mutation. */
export type MutateRemoveShiftsCoverageRequest = WireInput<RemoveShiftsCoverageMutationVariables["input"]>

/** The response of the `removeShiftsCoverage` mutation. */
type MutateRemoveShiftsCoverageResponse = RemoveShiftsCoverageMutation

const mutation1: TypedDocumentNode<
    MutateRemoveShiftsCoverageResponse,
    InputVariables<MutateRemoveShiftsCoverageRequest>
> = gql`
    mutation RemoveShiftsCoverage($input: ShiftsCoverageRefInput!) {
        removeShiftsCoverage(input: $input)
    }
`

enum MutationRemoveShiftsCoverage {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRemoveShiftsCoverage,
    TypedDocumentNode<MutateRemoveShiftsCoverageResponse, InputVariables<MutateRemoveShiftsCoverageRequest>>
> = {
    [MutationRemoveShiftsCoverage.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRemoveShiftsCoverage}. */
type MutateRemoveShiftsCoverageParams = MutateParams<MutationRemoveShiftsCoverage, MutateRemoveShiftsCoverageRequest>

/** Runs the `removeShiftsCoverage` mutation. */
export const mutateRemoveShiftsCoverage = async ({
    mutation = MutationRemoveShiftsCoverage.Mutation1,
    request,
    signal,
}: MutateRemoveShiftsCoverageParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
