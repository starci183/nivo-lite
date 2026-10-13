import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RunCsvImportMutation, RunCsvImportMutationVariables } from "../__generated__/graphql"

/** The input of the `runCsvImport` mutation. */
export type MutateRunCsvImportRequest = WireInput<RunCsvImportMutationVariables["input"]>

/** The response of the `runCsvImport` mutation. */
type MutateRunCsvImportResponse = RunCsvImportMutation

const mutation1: TypedDocumentNode<MutateRunCsvImportResponse, InputVariables<MutateRunCsvImportRequest>> = gql`
    mutation RunCsvImport($input: RunCsvImportInput!) {
        runCsvImport(input: $input) {
            connectionId
            added
            updated
            skipped
            total
            summary
        }
    }
`

enum MutationRunCsvImport {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRunCsvImport,
    TypedDocumentNode<MutateRunCsvImportResponse, InputVariables<MutateRunCsvImportRequest>>
> = {
    [MutationRunCsvImport.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateRunCsvImport}. */
type MutateRunCsvImportParams = MutateParams<MutationRunCsvImport, MutateRunCsvImportRequest>

/** Imports a table source (file, Google Sheets link, pasted or typed rows) with the chosen mapping. */
export const mutateRunCsvImport = async ({
    mutation = MutationRunCsvImport.Mutation1,
    request,
    signal,
}: MutateRunCsvImportParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
