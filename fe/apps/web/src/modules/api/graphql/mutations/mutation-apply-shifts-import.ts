import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ApplyShiftsImportMutation, ApplyShiftsImportMutationVariables } from "../__generated__/graphql"

/** The input of the `applyShiftsImport` mutation. */
export type MutateApplyShiftsImportRequest = WireInput<ApplyShiftsImportMutationVariables["input"]>

/** The response of the `applyShiftsImport` mutation. */
type MutateApplyShiftsImportResponse = ApplyShiftsImportMutation

const mutation1: TypedDocumentNode<
    MutateApplyShiftsImportResponse,
    InputVariables<MutateApplyShiftsImportRequest>
> = gql`
    mutation ApplyShiftsImport($input: ApplyShiftsImportInput!) {
        applyShiftsImport(input: $input) {
            blocks
            positions
            staff
        }
    }
`

enum MutationApplyShiftsImport {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationApplyShiftsImport,
    TypedDocumentNode<MutateApplyShiftsImportResponse, InputVariables<MutateApplyShiftsImportRequest>>
> = {
    [MutationApplyShiftsImport.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateApplyShiftsImport}. */
type MutateApplyShiftsImportParams = MutateParams<MutationApplyShiftsImport, MutateApplyShiftsImportRequest>

/** Runs the `applyShiftsImport` mutation. */
export const mutateApplyShiftsImport = async ({
    mutation = MutationApplyShiftsImport.Mutation1,
    request,
    signal,
}: MutateApplyShiftsImportParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
