import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { RunFlowMutation, RunFlowMutationVariables } from "../__generated__/graphql"

/** The input of the `runFlow` mutation: the flow command and its payload. */
export type MutateRunFlowRequest = WireInput<RunFlowMutationVariables["input"]>

type MutateRunFlowResponse = RunFlowMutation

const mutation1: TypedDocumentNode<MutateRunFlowResponse, InputVariables<MutateRunFlowRequest>> = gql`
    mutation RunFlow($input: RunFlowInput!) {
        runFlow(input: $input) {
            data
        }
    }
`

enum MutationRunFlow {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationRunFlow, TypedDocumentNode<MutateRunFlowResponse, InputVariables<MutateRunFlowRequest>>> = {
    [MutationRunFlow.Mutation1]: mutation1,
}

/**
 * The back end `runFlow` mutation: one command of the operating flow as the signed-in member. Kind `decide` answers a work item
 * (`{ workItemId, decision: "approved" | "rejected", locale }`) through the work items' own decision door.
 */
export const mutateRunFlow = async ({
    mutation = MutationRunFlow.Mutation1,
    request,
    signal,
    headers,
}: MutateParams<MutationRunFlow, MutateRunFlowRequest>): Promise<ApolloClient.MutateResult<MutateRunFlowResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal, headers })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request }, context: { headers } })
}
