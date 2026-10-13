import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationDraftLeadExecutionArgs } from "../__generated__/schema"

/** The input of the `draftLeadExecution` mutation. */
export type MutateDraftLeadExecutionRequest = MutationDraftLeadExecutionArgs["input"]

/** The response of the `draftLeadExecution` mutation. */
type MutateDraftLeadExecutionResponse = Pick<Mutation, "draftLeadExecution">

const mutation1: TypedDocumentNode<MutateDraftLeadExecutionResponse, InputVariables<MutateDraftLeadExecutionRequest>> = gql`
    mutation DraftLeadExecution($input: DraftLeadExecutionInput!) {
        draftLeadExecution(input: $input) {
            id
            status
        }
    }
`

enum MutationDraftLeadExecution {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationDraftLeadExecution,
    TypedDocumentNode<MutateDraftLeadExecutionResponse, InputVariables<MutateDraftLeadExecutionRequest>>
> = {
    [MutationDraftLeadExecution.Mutation1]: mutation1,
}

/** Apollo params for {@link mutateDraftLeadExecution}. */
type MutateDraftLeadExecutionParams = MutateParams<MutationDraftLeadExecution, MutateDraftLeadExecutionRequest>

/** Queues a follow-up draft for the customer behind a responsibility (the back end `draftLeadExecution` mutation). */
export const mutateDraftLeadExecution = async ({
    mutation = MutationDraftLeadExecution.Mutation1,
    request,
    signal,
}: MutateDraftLeadExecutionParams) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
