import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { SetAgentWorkflowStatusMutation, SetAgentWorkflowStatusMutationVariables } from "../__generated__/graphql"

/** The input of the `setAgentWorkflowStatus` mutation. */
export type MutateSetAgentWorkflowStatusRequest = WireInput<SetAgentWorkflowStatusMutationVariables["input"]>

type SetAgentWorkflowStatusMutationResponse = SetAgentWorkflowStatusMutation

const mutation1: TypedDocumentNode<SetAgentWorkflowStatusMutationResponse, InputVariables<MutateSetAgentWorkflowStatusRequest>> = gql`
    mutation SetAgentWorkflowStatus($input: SetAgentWorkflowStatusInput!) {
        setAgentWorkflowStatus(input: $input) 
    }
`

enum MutationSetAgentWorkflowStatus {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationSetAgentWorkflowStatus, TypedDocumentNode<SetAgentWorkflowStatusMutationResponse, InputVariables<MutateSetAgentWorkflowStatusRequest>>> = {
    [MutationSetAgentWorkflowStatus.Mutation1]: mutation1,
}

/** The back end `setAgentWorkflowStatus` mutation. Sets where a workflow stands. */
export const mutateSetAgentWorkflowStatus = async ({
    mutation = MutationSetAgentWorkflowStatus.Mutation1,
    request,
    signal,
}: MutateParams<MutationSetAgentWorkflowStatus, MutateSetAgentWorkflowStatusRequest>): Promise<ApolloClient.MutateResult<SetAgentWorkflowStatusMutationResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
