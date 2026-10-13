import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RetryFailedStepMutation, RetryFailedStepMutationVariables } from "../__generated__/graphql"

/** Generated input of the retryFailedStep mutation. */
export type MutateRetryFailedStepRequest = WireInput<RetryFailedStepMutationVariables["input"]>

/** Generated response of the retryFailedStep mutation. */
type MutateRetryFailedStepResponse = RetryFailedStepMutation

type Document = TypedDocumentNode<MutateRetryFailedStepResponse, InputVariables<MutateRetryFailedStepRequest>>

const mutation1: Document = gql`
    mutation RetryFailedStep($input: RetryFailedStepInput!) {
        retryFailedStep(input: $input) {
            errorCode
            id
            status
            workItemId
        }
    }
`

enum MutationRetryFailedStep {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRetryFailedStep, Document> = {
    [MutationRetryFailedStep.Mutation1]: mutation1,
}

/** Apollo parameters for the retryFailedStep mutation. */
type MutateRetryFailedStepParams = MutateParams<MutationRetryFailedStep, MutateRetryFailedStepRequest>

/** Runs the workspace-scoped retryFailedStep mutation through the authenticated GraphQL client. */
export const mutateRetryFailedStep = async ({
    mutation = MutationRetryFailedStep.Mutation1,
    request,
    signal,
    headers,
}: MutateRetryFailedStepParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
