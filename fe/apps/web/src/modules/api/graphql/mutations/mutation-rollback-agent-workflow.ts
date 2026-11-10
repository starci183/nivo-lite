import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RollbackAgentWorkflowMutation, RollbackAgentWorkflowMutationVariables } from "../__generated__/graphql"

/** The input of the `rollbackAgentWorkflow` mutation. */
export type MutateRollbackAgentWorkflowRequest = WireInput<RollbackAgentWorkflowMutationVariables["input"]>

type RollbackAgentWorkflowMutationResponse = RollbackAgentWorkflowMutation

const mutation1: TypedDocumentNode<RollbackAgentWorkflowMutationResponse, InputVariables<MutateRollbackAgentWorkflowRequest>> = gql`
    mutation RollbackAgentWorkflow($input: RollbackAgentWorkflowInput!) {
        rollbackAgentWorkflow(input: $input) { id number changeKind authorKind authorId note templateId templateVersion fromNumber publishedAt stepCount changedSteps active }
    }
`

enum MutationRollbackAgentWorkflow {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRollbackAgentWorkflow, TypedDocumentNode<RollbackAgentWorkflowMutationResponse, InputVariables<MutateRollbackAgentWorkflowRequest>>> = {
    [MutationRollbackAgentWorkflow.Mutation1]: mutation1,
}

/** The back end `rollbackAgentWorkflow` mutation. Writes a new version that copies an old one. */
export const mutateRollbackAgentWorkflow = async ({
    mutation = MutationRollbackAgentWorkflow.Mutation1,
    request,
    signal,
}: MutateParams<MutationRollbackAgentWorkflow, MutateRollbackAgentWorkflowRequest>): Promise<ApolloClient.MutateResult<RollbackAgentWorkflowMutationResponse>> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
