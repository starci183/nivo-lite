import { gql } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    RenameInstallationAgentMutation,
    RenameInstallationAgentMutationVariables,
} from "../__generated__/graphql"

/** The input of the `renameInstallationAgent` mutation. */
export type MutateRenameInstallationAgentRequest = WireInput<RenameInstallationAgentMutationVariables["input"]>

type MutateRenameInstallationAgentResponse = RenameInstallationAgentMutation

const mutation1: TypedDocumentNode<
    MutateRenameInstallationAgentResponse,
    InputVariables<MutateRenameInstallationAgentRequest>
> = gql`
    mutation RenameInstallationAgent($input: RenameInstallationAgentInput!) {
        renameInstallationAgent(input: $input) {
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

enum MutationRenameInstallationAgent {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationRenameInstallationAgent,
    TypedDocumentNode<MutateRenameInstallationAgentResponse, InputVariables<MutateRenameInstallationAgentRequest>>
> = {
    [MutationRenameInstallationAgent.Mutation1]: mutation1,
}

/** The back end `renameInstallationAgent` mutation. */
export const mutateRenameInstallationAgent = async ({
    mutation = MutationRenameInstallationAgent.Mutation1,
    request,
    signal,
}: MutateParams<MutationRenameInstallationAgent, MutateRenameInstallationAgentRequest>) => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
