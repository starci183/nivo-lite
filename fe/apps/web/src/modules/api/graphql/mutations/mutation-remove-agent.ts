import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type { RemoveAgentMutation, RemoveAgentMutationVariables } from "../__generated__/graphql"

/** The input of the `removeAgent` mutation. */
export type MutateRemoveAgentRequest = WireInput<RemoveAgentMutationVariables["input"]>

type MutateRemoveAgentResponse = RemoveAgentMutation

const mutation1: TypedDocumentNode<MutateRemoveAgentResponse, InputVariables<MutateRemoveAgentRequest>> = gql`
    mutation RemoveAgent($input: ModuleInstallationIdInput!) {
        removeAgent(input: $input) {
            activeContextVersionId
            activeVersion
            agentHandle
            agentId
            agentName
            createdAt
            id
            isMulti
            lifecycle
            liveEnabled
            moduleKey
            name
            operatingMode
            settings
            status
            workspaceId
        }
    }
`

enum MutationRemoveAgent {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRemoveAgent,
    TypedDocumentNode<MutateRemoveAgentResponse, InputVariables<MutateRemoveAgentRequest>>
> = {
    [MutationRemoveAgent.Mutation1]: mutation1,
}

/** The back end `removeAgent` mutation. */
export const mutateRemoveAgent = async ({
    mutation = MutationRemoveAgent.Mutation1,
    request,
    signal,
}: MutateParams<MutationRemoveAgent, MutateRemoveAgentRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
