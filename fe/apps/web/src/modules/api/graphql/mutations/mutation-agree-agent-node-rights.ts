import { gql, type ApolloClient, type TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient, type InputVariables, type MutateParams, type WireInput } from "@nivo-lite/api"
import { webApiTransport } from "@/modules/api-transport"
import type { AgreeAgentNodeRightsMutation, AgreeAgentNodeRightsMutationVariables } from "../__generated__/graphql"

/** The input of the `agreeAgentNodeRights` mutation. */
export type MutateAgreeAgentNodeRightsRequest = WireInput<AgreeAgentNodeRightsMutationVariables["input"]>

type AgreeAgentNodeRightsMutationResponse = AgreeAgentNodeRightsMutation

const mutation1: TypedDocumentNode<AgreeAgentNodeRightsMutationResponse, InputVariables<MutateAgreeAgentNodeRightsRequest>> = gql`
    mutation AgreeAgentNodeRights($input: AgreeAgentNodeRightsInput!) {
        agreeAgentNodeRights(input: $input) {
            agreed
            nodeRightsDecide
        }
    }
`

enum MutationAgreeAgentNodeRights {
    Mutation1 = "mutation1",
}

const mutationMap: Record<MutationAgreeAgentNodeRights, TypedDocumentNode<AgreeAgentNodeRightsMutationResponse, InputVariables<MutateAgreeAgentNodeRightsRequest>>> = {
    [MutationAgreeAgentNodeRights.Mutation1]: mutation1,
}

/** The back end `agreeAgentNodeRights` mutation: the owner agrees ALL of an agent's waiting rights at once (all rows or none). */
export const mutateAgreeAgentNodeRights = async ({
    mutation = MutationAgreeAgentNodeRights.Mutation1,
    request,
    signal,
}: MutateParams<MutationAgreeAgentNodeRights, MutateAgreeAgentNodeRightsRequest>): Promise<ApolloClient.MutateResult<AgreeAgentNodeRightsMutationResponse>> => {
    const apollo = createAuthApolloClient(webApiTransport, { signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
