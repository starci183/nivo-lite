import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationSaveContractArgs } from "../__generated__/schema"

/** Generated input of the saveContract mutation. */
export type MutateSaveContractRequest = MutationSaveContractArgs["input"]

/** Generated response of the saveContract mutation. */
type MutateSaveContractResponse = Pick<Mutation, "saveContract">

type Document = TypedDocumentNode<MutateSaveContractResponse, InputVariables<MutateSaveContractRequest>>

const mutation1: Document = gql`
    mutation SaveContract($input: SaveContractInput!) {
        saveContract(input: $input) {
            amountVnd
            customerName
            endsOn
            id
            leadId
            note
            plan
            startsOn
            status
        }
    }
`

enum MutationSaveContract {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSaveContract, Document> = {
    [MutationSaveContract.Mutation1]: mutation1,
}

/** Apollo parameters for the saveContract mutation. */
type MutateSaveContractParams = MutateParams<MutationSaveContract, MutateSaveContractRequest>

/** Runs the workspace-scoped saveContract mutation through the authenticated GraphQL client. */
export const mutateSaveContract = async ({
    mutation = MutationSaveContract.Mutation1,
    request,
    signal,
    headers,
}: MutateSaveContractParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
