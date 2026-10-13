import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationHandoffToAccountingArgs } from "../__generated__/schema"

/** Generated input of the handoffToAccounting mutation. */
export type MutateHandoffToAccountingRequest = MutationHandoffToAccountingArgs["input"]

/** Generated response of the handoffToAccounting mutation. */
type MutateHandoffToAccountingResponse = Pick<Mutation, "handoffToAccounting">

type Document = TypedDocumentNode<MutateHandoffToAccountingResponse, InputVariables<MutateHandoffToAccountingRequest>>

const mutation1: Document = gql`
    mutation HandoffToAccounting($input: HandoffToAccountingInput!) {
        handoffToAccounting(input: $input) {
            errorCode
            id
            status
            workItemId
        }
    }
`

enum MutationHandoffToAccounting {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationHandoffToAccounting, Document> = {
    [MutationHandoffToAccounting.Mutation1]: mutation1,
}

/** Apollo parameters for the handoffToAccounting mutation. */
type MutateHandoffToAccountingParams = MutateParams<MutationHandoffToAccounting, MutateHandoffToAccountingRequest>

/** Runs the workspace-scoped handoffToAccounting mutation through the authenticated GraphQL client. */
export const mutateHandoffToAccounting = async ({
    mutation = MutationHandoffToAccounting.Mutation1,
    request,
    signal,
    headers,
}: MutateHandoffToAccountingParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
