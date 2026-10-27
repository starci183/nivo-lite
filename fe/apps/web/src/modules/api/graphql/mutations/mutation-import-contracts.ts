import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { ImportContractsMutation, ImportContractsMutationVariables } from "../__generated__/graphql"

/** Generated input of the importContracts mutation. */
export type MutateImportContractsRequest = WireInput<ImportContractsMutationVariables["input"]>

/** Generated response of the importContracts mutation. */
type MutateImportContractsResponse = ImportContractsMutation

type Document = TypedDocumentNode<MutateImportContractsResponse, InputVariables<MutateImportContractsRequest>>

const mutation1: Document = gql`
    mutation ImportContracts($input: ImportContractsInput!) {
        importContracts(input: $input) {
            created
            skipped {
                row
                reason
            }
        }
    }
`

enum MutationImportContracts {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationImportContracts, Document> = {
    [MutationImportContracts.Mutation1]: mutation1,
}

/** Apollo parameters for the importContracts mutation. */
type MutateImportContractsParams = MutateParams<MutationImportContracts, MutateImportContractsRequest>

/** Runs the workspace-scoped importContracts mutation through the authenticated GraphQL client. */
export const mutateImportContracts = async ({
    mutation = MutationImportContracts.Mutation1,
    request,
    signal,
    headers,
}: MutateImportContractsParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
