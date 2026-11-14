import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { CreateAgentWorkflowMutation, CreateAgentWorkflowMutationVariables } from "../__generated__/graphql"

/** The input of the `createAgentWorkflow` mutation. */
export type MutateCreateAgentWorkflowRequest = WireInput<CreateAgentWorkflowMutationVariables["input"]>

type CreateAgentWorkflowMutationResponse = CreateAgentWorkflowMutation

const mutation1: TypedDocumentNode<CreateAgentWorkflowMutationResponse, InputVariables<MutateCreateAgentWorkflowRequest>> = gql`
    mutation CreateAgentWorkflow($input: CreateAgentWorkflowInput!) {
        createAgentWorkflow(input: $input) { id key name status primary activeNumber latestNumber templateId templateVersion templateName templateLatest templateChangedSteps stepCount updatedAt }
    }
`

enum MutationCreateAgentWorkflow {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationCreateAgentWorkflow, TypedDocumentNode<CreateAgentWorkflowMutationResponse, InputVariables<MutateCreateAgentWorkflowRequest>>> = {
    [MutationCreateAgentWorkflow.Mutation1]: mutation1,
}

/** The back end `createAgentWorkflow` mutation. Makes a workflow from a template or blank. */
export const mutateCreateAgentWorkflow = async ({
    mutation = MutationCreateAgentWorkflow.Mutation1,
    request,
    signal,
}: MutateParams<MutationCreateAgentWorkflow, MutateCreateAgentWorkflowRequest>): Promise<ApolloClient.MutateResult<CreateAgentWorkflowMutationResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
