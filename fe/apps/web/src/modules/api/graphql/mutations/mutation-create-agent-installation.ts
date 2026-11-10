import { gql, type ApolloClient } from "@apollo/client"
import type { TypedDocumentNode } from "@apollo/client"
import { createAuthApolloClient } from "../clients"
import type { InputVariables, MutateParams, WireInput } from "../types"
import type {
    CreateAgentInstallationMutation,
    CreateAgentInstallationMutationVariables,
} from "../__generated__/graphql"

/** The input of the `createAgentInstallation` mutation. */
export type MutateCreateAgentInstallationRequest = WireInput<CreateAgentInstallationMutationVariables["input"]>

type MutateCreateAgentInstallationResponse = CreateAgentInstallationMutation

const mutation1: TypedDocumentNode<
    MutateCreateAgentInstallationResponse,
    InputVariables<MutateCreateAgentInstallationRequest>
> = gql`
    mutation CreateAgentInstallation($input: CreateAgentInstallationInput!) {
        createAgentInstallation(input: $input) {
            agentId
            channels
            installationId
            copied {
                connections
                contextVersion
                fromInstallationId
                graph
                rules
                settings
            }
        }
    }
`

enum MutationCreateAgentInstallation {
    Mutation1 = "mutation1",
}

const mutationMap: Record<
    MutationCreateAgentInstallation,
    TypedDocumentNode<MutateCreateAgentInstallationResponse, InputVariables<MutateCreateAgentInstallationRequest>>
> = {
    [MutationCreateAgentInstallation.Mutation1]: mutation1,
}

/** The back end `createAgentInstallation` mutation: one more agent of a role, with its own name, picture, handle and channels. */
export const mutateCreateAgentInstallation = async ({
    mutation = MutationCreateAgentInstallation.Mutation1,
    request,
    signal,
}: MutateParams<MutationCreateAgentInstallation, MutateCreateAgentInstallationRequest>): Promise<
    ApolloClient.MutateResult<MutateCreateAgentInstallationResponse>
> => {
    const apollo = createAuthApolloClient({ signal })
    return apollo.mutate({ mutation: mutationMap[mutation], variables: { input: request } })
}
