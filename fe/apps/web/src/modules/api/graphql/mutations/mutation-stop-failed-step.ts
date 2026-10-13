import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams } from "../types"
import type { Mutation, MutationStopFailedStepArgs } from "../__generated__/schema"

/** Generated input of the stopFailedStep mutation. */
export type MutateStopFailedStepRequest = MutationStopFailedStepArgs["input"]

/** Generated response of the stopFailedStep mutation. */
type MutateStopFailedStepResponse = Pick<Mutation, "stopFailedStep">

type Document = TypedDocumentNode<MutateStopFailedStepResponse, InputVariables<MutateStopFailedStepRequest>>

const mutation1: Document = gql`
    mutation StopFailedStep($input: StopFailedStepInput!) {
        stopFailedStep(input: $input) {
            id
            status
        }
    }
`

enum MutationStopFailedStep {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationStopFailedStep, Document> = {
    [MutationStopFailedStep.Mutation1]: mutation1,
}

/** Apollo parameters for the stopFailedStep mutation. */
type MutateStopFailedStepParams = MutateParams<MutationStopFailedStep, MutateStopFailedStepRequest>

/** Runs the workspace-scoped stopFailedStep mutation through the authenticated GraphQL client. */
export const mutateStopFailedStep = async ({
    mutation = MutationStopFailedStep.Mutation1,
    request,
    signal,
    headers,
}: MutateStopFailedStepParams) => {
    const apollo = createAuthApolloClient({ signal, headers })
    return apollo.mutate({
        mutation: mutationMap[mutation],
        variables: { input: request },
    })
}
